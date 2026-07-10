import type { CodexAppServerClient, ConfigReadResult, SideThreadForkOptions } from "../codex/app-server.js";
import type { SessionRow, UiLanguage } from "../types.js";
import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import { buildSideParentStatusMessage, buildSideReturnConfirmationMessage } from "../telegram/ui-side.js";
import type { SideCardViewModel, SideParentStatus } from "../telegram/ui-side.js";

export const SIDE_MIN_CODEX_VERSION = [0, 144, 1] as const;
export const SIDE_ALLOWED_COMMANDS = new Set(["status", "where", "inspect", "retrieve", "interrupt", "side"]);

export const SIDE_BOUNDARY_PROMPT = [
  "This message is the Side conversation boundary.",
  "Inherited history is reference context only, not an active task. Only messages after this boundary are active.",
  "Do not continue inherited tasks, plans, tool calls, or approvals.",
  "You are a separate Side assistant for questions and lightweight exploration. Subagents are off-limits.",
  "Do not mutate anything unless explicitly requested after this boundary. Do not escalate unless an explicit mutation requires it."
].join("\n");

const SIDE_DEVELOPER_POLICY = [
  "SIDE CONVERSATION SAFETY POLICY:",
  "Treat inherited history as reference context only, never as an active task.",
  "Only post-boundary messages are active. Do not continue inherited tasks, plans, tool calls, or approvals.",
  "Act as a separate side assistant for questions and lightweight exploration. Do not use subagents.",
  "Do not make mutations unless explicitly requested after the boundary. Do not escalate unless an explicit mutation needs it."
].join("\n");

interface SideStore {
  getActiveSession(chatId: string): SessionRow | null;
  getSessionById(sessionId: string): SessionRow | null;
  getSideParent(sideSessionId: string): SessionRow | null;
  getActiveSideForParent(parentSessionId: string): SessionRow | null;
  createSideSession(options: { parentSessionId: string; threadId: string }): SessionRow;
  restoreParentAndDeleteSide(sideSessionId: string): { side: SessionRow; parent: SessionRow } | null;
  restoreFallbackAndDeleteOrphanedSide(sideSessionId: string): { side: SessionRow; fallback: SessionRow | null } | null;
}

type SideClient = Pick<CodexAppServerClient,
  "readConfig" | "forkSideThread" | "injectThreadItems" | "unsubscribeThread" | "interruptTurn">;

export interface SideConversationCoordinatorDeps {
  getStore(): SideStore | null;
  ensureAppServerAvailable(): Promise<SideClient>;
  getCodexVersion(): string | null;
  getRunningTurnCapacity(chatId: string): { allowed: boolean; limit: number; running: number };
  getActiveTurn(sessionId: string): { threadId: string; turnId: string } | null;
  startTextTurn(chatId: string, session: SessionRow, text: string): Promise<void>;
  syncCurrentSessionCard(chatId: string, reason: string): Promise<void>;
  surfacePendingInteractions(chatId: string, sessionId: string): Promise<void>;
  expireSideInteractions(chatId: string, sessionId: string, reason: "side_closed"): Promise<void>;
  clearSideTransientInput(chatId: string, sessionId: string): void;
  releaseHeldTerminalResults(chatId: string, sessionId: string): Promise<number>;
  getParentStatus(parent: SessionRow): SideParentStatus;
  parentNeedsAction(chatId: string, parentSessionId: string): boolean;
  countHeldResults(parentSessionId: string): number;
  getUiLanguage(): UiLanguage;
  safeSendMessage(chatId: string, text: string, replyMarkup?: TelegramInlineKeyboardMarkup): Promise<boolean>;
  safeSendHtmlMessage(chatId: string, html: string, replyMarkup?: TelegramInlineKeyboardMarkup): Promise<boolean>;
  nowMs(): number;
  createToken(): string;
  logger?: { warn(message: string, details?: unknown): void };
}

interface CardBinding {
  chatId: string;
  sideSessionId: string;
  generation: number;
  kind: "card";
  token: string;
}

interface SideReturnConfirmation {
  chatId: string;
  sideSessionId: string;
  parentSessionId: string;
  expiresAtMs: number;
  consumed: boolean;
}

export type SideCardAction = "status" | "back" | "interrupt" | "return_confirm" | "return_cancel";

const RETURN_CONFIRMATION_TTL_MS = 120_000;
const STALE_SIDE_ACTION = "这个 Side 操作已失效。";

export class SideConversationCoordinator {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly cardBindings = new Map<string, CardBinding>();
  private readonly returnConfirmations = new Map<string, SideReturnConfirmation>();
  private generation = 0;

  constructor(private readonly deps: SideConversationCoordinatorDeps) {}

  async handleCommand(chatId: string, args: string): Promise<void> {
    await this.enqueue(chatId, async () => {
      if (args.trim().toLowerCase() === "back") await this.beginReturn(chatId, null);
      else await this.createSide(chatId, args);
    });
  }

  async handleCardAction(chatId: string, action: SideCardAction, token: string): Promise<string | null> {
    return await this.enqueue(chatId, async () => {
      if (action === "return_confirm" || action === "return_cancel") {
        return await this.consumeReturnConfirmation(chatId, action, token);
      }
      const relationship = this.resolveCardBinding(chatId, token);
      if (!relationship) { await this.stale(chatId); return null; }
      if (action === "back") return await this.beginReturn(chatId, relationship.side);
      if (!relationship.parent) { await this.stale(chatId); return null; }
      if (action === "status") {
        const view = this.getCardView(relationship.side);
        if (!view) { await this.stale(chatId); return null; }
        await this.deps.safeSendHtmlMessage(chatId, buildSideParentStatusMessage(view));
        return null;
      }
      if (action === "interrupt") {
        const turn = this.deps.getActiveTurn(relationship.side.sessionId);
        if (!turn || turn.threadId !== relationship.side.threadId) { await this.stale(chatId); return null; }
        try { await (await this.deps.ensureAppServerAvailable()).interruptTurn(turn.threadId, turn.turnId); }
        catch (error) {
          this.warn("side interrupt failed", error);
          await this.deps.safeSendMessage(chatId, this.en("Could not interrupt Side. Please retry.", "无法中断 Side，请重试。"));
        }
        return null;
      }
      return null;
    });
  }

  private async enqueue<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(chatId) ?? Promise.resolve();
    const execution = previous.catch(() => undefined).then(operation);
    const tail = execution.then(() => undefined, () => undefined);
    this.queues.set(chatId, tail);
    try {
      return await execution;
    } finally {
      if (this.queues.get(chatId) === tail) this.queues.delete(chatId);
    }
  }

  isCommandAllowed(commandName: string): boolean {
    return SIDE_ALLOWED_COMMANDS.has(commandName);
  }

  isParentSurfaceHeld(sessionId: string): boolean {
    const store = this.deps.getStore();
    const parent = store?.getSessionById(sessionId);
    const side = store?.getActiveSideForParent(sessionId);
    if (!store || !parent || parent.sessionKind !== "regular" || !side
      || side.sessionKind !== "side" || side.parentSessionId !== parent.sessionId) return false;
    const resolvedParent = store.getSideParent(side.sessionId);
    return Boolean(resolvedParent
      && resolvedParent.sessionId === parent.sessionId
      && resolvedParent.sessionKind === "regular"
      && side.chatId === parent.chatId
      && side.projectPath === parent.projectPath);
  }

  getCardView(sideSession: SessionRow): SideCardViewModel | null {
    const store = this.deps.getStore();
    const persistedSide = store?.getSessionById(sideSession.sessionId);
    const parent = store?.getSideParent(sideSession.sessionId);
    if (!persistedSide || persistedSide.sessionKind !== "side" || !parent
      || persistedSide.parentSessionId !== parent.sessionId || persistedSide.chatId !== parent.chatId
      || persistedSide.projectPath !== parent.projectPath || parent.sessionKind !== "regular") return null;
    const activeSide = store?.getActiveSession(persistedSide.chatId);
    if (activeSide?.sessionId !== persistedSide.sessionId) return null;

    let binding = this.cardBindings.get(persistedSide.sessionId);
    if (!binding || binding.chatId !== persistedSide.chatId) {
      binding = { chatId: persistedSide.chatId, sideSessionId: persistedSide.sessionId,
        generation: ++this.generation, kind: "card", token: this.deps.createToken() };
      this.cardBindings.set(persistedSide.sessionId, binding);
    }
    return {
      token: binding.token,
      language: this.deps.getUiLanguage(),
      projectName: persistedSide.projectName,
      parentSessionName: parent.displayName,
      sideStatus: persistedSide.status,
      parentStatus: this.deps.getParentStatus(parent),
      parentNeedsAction: this.deps.parentNeedsAction(persistedSide.chatId, parent.sessionId),
      heldResultCount: this.deps.countHeldResults(parent.sessionId)
    };
  }

  private resolveCardBinding(chatId: string, token: string): { side: SessionRow; parent: SessionRow | null } | null {
    const binding = [...this.cardBindings.values()].find((value) => value.token === token);
    const store = this.deps.getStore();
    if (!binding || binding.chatId !== chatId || !store) return null;
    const side = store.getActiveSession(chatId);
    if (!side || side.sessionId !== binding.sideSessionId || side.sessionKind !== "side") return null;
    const parent = store.getSideParent(side.sessionId);
    if (parent && (parent.sessionId !== side.parentSessionId || parent.sessionKind !== "regular")) return null;
    return { side, parent };
  }

  private async beginReturn(chatId: string, expectedSide: SessionRow | null): Promise<string | null> {
    const store = this.deps.getStore();
    const side = store?.getActiveSession(chatId) ?? null;
    if (!store || !side || side.sessionKind !== "side" || (expectedSide && side.sessionId !== expectedSide.sessionId)) {
      await this.stale(chatId); return null;
    }
    const parent = store.getSideParent(side.sessionId);
    if (!parent || parent.sessionId !== side.parentSessionId) {
      await this.closeOrphanedSide(chatId, side); return null;
    }
    const turn = this.deps.getActiveTurn(side.sessionId);
    if (!turn) { await this.closeSide(chatId, side, parent, false); return null; }
    if (turn.threadId !== side.threadId) { await this.stale(chatId); return null; }
    this.invalidateConfirmationsForSide(side.sessionId);
    const token = this.deps.createToken();
    this.returnConfirmations.set(token, { chatId, sideSessionId: side.sessionId,
      parentSessionId: parent.sessionId, expiresAtMs: this.deps.nowMs() + RETURN_CONFIRMATION_TTL_MS, consumed: false });
    const confirmation = buildSideReturnConfirmationMessage(token, this.deps.getUiLanguage());
    await this.deps.safeSendMessage(chatId, confirmation.text, confirmation.replyMarkup);
    return token;
  }

  private async consumeReturnConfirmation(chatId: string, action: "return_confirm" | "return_cancel", token: string): Promise<null> {
    const confirmation = this.returnConfirmations.get(token);
    if (!confirmation || confirmation.consumed || confirmation.expiresAtMs < this.deps.nowMs()) {
      this.returnConfirmations.delete(token); await this.stale(chatId); return null;
    }
    confirmation.consumed = true;
    this.returnConfirmations.delete(token);
    if (confirmation.chatId !== chatId) { await this.stale(chatId); return null; }
    const store = this.deps.getStore();
    const side = store?.getActiveSession(chatId) ?? null;
    const parent = side?.sessionKind === "side" ? store?.getSideParent(side.sessionId) ?? null : null;
    if (!side || side.sessionId !== confirmation.sideSessionId) { await this.stale(chatId); return null; }
    if (!parent) { await this.closeOrphanedSide(chatId, side); return null; }
    if (parent.sessionId !== confirmation.parentSessionId) { await this.stale(chatId); return null; }
    if (action === "return_cancel") {
      await this.deps.syncCurrentSessionCard(chatId, "side_return_cancelled"); return null;
    }
    await this.closeSide(chatId, side, parent, true);
    return null;
  }

  private async closeSide(chatId: string, side: SessionRow, parent: SessionRow, confirmed: boolean): Promise<void> {
    if (!side.threadId) { await this.stale(chatId); return; }
    let restored: { side: SessionRow; parent: SessionRow } | null = null;
    try {
      const client = await this.deps.ensureAppServerAvailable();
      if (confirmed) {
        const turn = this.deps.getActiveTurn(side.sessionId);
        if (turn) {
          if (turn.threadId !== side.threadId) { await this.stale(chatId); return; }
          await client.interruptTurn(turn.threadId, turn.turnId);
        }
      }
      await this.deps.expireSideInteractions(chatId, side.sessionId, "side_closed");
      this.deps.clearSideTransientInput(chatId, side.sessionId);
      await client.unsubscribeThread(side.threadId);
      restored = this.deps.getStore()?.restoreParentAndDeleteSide(side.sessionId) ?? null;
      if (!restored || restored.parent.sessionId !== parent.sessionId) throw new Error("side relationship changed during return");
    } catch (error) {
      this.warn("side return failed", error);
      await this.deps.syncCurrentSessionCard(chatId, "side_return_failed").catch((syncError) => this.warn("side card refresh failed", syncError));
      await this.sendReturnFailed(chatId);
      return;
    }
    this.invalidateSideTokens(side.sessionId);
    await this.runAfterReturn("sync parent card", () => this.deps.syncCurrentSessionCard(chatId, "side_returned"));
    await this.runAfterReturn("surface parent interactions", () => this.deps.surfacePendingInteractions(chatId, parent.sessionId));
    await this.runAfterReturn("release held terminal results", () => this.deps.releaseHeldTerminalResults(chatId, parent.sessionId));
  }

  private async closeOrphanedSide(chatId: string, side: SessionRow): Promise<void> {
    if (!side.threadId) { await this.stale(chatId); return; }
    let recovered: { side: SessionRow; fallback: SessionRow | null } | null = null;
    try {
      await this.deps.expireSideInteractions(chatId, side.sessionId, "side_closed");
      this.deps.clearSideTransientInput(chatId, side.sessionId);
      await (await this.deps.ensureAppServerAvailable()).unsubscribeThread(side.threadId);
      recovered = this.deps.getStore()?.restoreFallbackAndDeleteOrphanedSide(side.sessionId) ?? null;
      if (!recovered) throw new Error("orphaned side relationship changed during recovery");
    } catch (error) {
      this.warn("orphaned side return failed", error);
      await this.deps.syncCurrentSessionCard(chatId, "side_return_failed").catch((syncError) => this.warn("side card refresh failed", syncError));
      await this.sendReturnFailed(chatId);
      return;
    }
    this.invalidateSideTokens(side.sessionId);
    await this.runAfterReturn("sync fallback card", () => this.deps.syncCurrentSessionCard(chatId, "side_returned"));
    if (recovered.fallback) {
      await this.runAfterReturn("surface fallback interactions", () => this.deps.surfacePendingInteractions(chatId, recovered!.fallback!.sessionId));
      await this.runAfterReturn("release fallback held results", () => this.deps.releaseHeldTerminalResults(chatId, recovered!.fallback!.sessionId));
    }
  }

  private async runAfterReturn(label: string, operation: () => Promise<unknown>): Promise<void> {
    try { await operation(); } catch (error) { this.warn(`failed to ${label} after side return`, error); }
  }

  private invalidateSideTokens(sideSessionId: string): void {
    this.cardBindings.delete(sideSessionId);
    this.invalidateConfirmationsForSide(sideSessionId);
  }

  private invalidateConfirmationsForSide(sideSessionId: string): void {
    for (const [token, value] of this.returnConfirmations) if (value.sideSessionId === sideSessionId) this.returnConfirmations.delete(token);
  }

  private async stale(chatId: string): Promise<void> { await this.deps.safeSendMessage(chatId, STALE_SIDE_ACTION); }
  private async sendReturnFailed(chatId: string): Promise<void> {
    await this.deps.safeSendMessage(chatId, this.en(
      "Could not return to the main conversation. Side remains active; please retry.",
      "返回主会话未完成，Side 仍保持活动，请重试。"));
  }

  private async createSide(chatId: string, args: string): Promise<void> {
    const store = this.deps.getStore();
    const parent = store?.getActiveSession(chatId) ?? null;
    if (!store || !parent) {
      await this.deps.safeSendMessage(chatId, this.en("No active session. Start or select a session first.", "没有活动会话，请先开始或选择一个会话。"));
      return;
    }
    if (parent.sessionKind === "side") {
      this.getCardView(parent);
      await this.deps.syncCurrentSessionCard(chatId, "side_entered");
      await this.deps.safeSendMessage(chatId, this.en(
        "You are already in a Side conversation. Side conversations cannot be nested; use the card to return to main.",
        "你已在 Side 对话中。Side 不能嵌套，请使用卡片返回主会话。"));
      return;
    }
    if (!parent.threadId) {
      await this.deps.safeSendMessage(chatId, this.en(
        "Complete the first task in this session before opening a Side conversation.",
        "请先完成此会话中的第一个任务，再开启 Side 对话。"));
      return;
    }
    const capacity = this.deps.getRunningTurnCapacity(chatId);
    if (!capacity.allowed) {
      await this.deps.safeSendMessage(chatId, this.en(
        `Side cannot start: running-turn capacity is full (${capacity.running}/${capacity.limit}).`,
        `无法开启 Side：运行任务已达上限（${capacity.running}/${capacity.limit}）。`));
      return;
    }
    const version = this.deps.getCodexVersion();
    if (version !== null && !meetsMinimumVersion(version)) {
      await this.sendUpdateRequired(chatId);
      return;
    }

    let client: SideClient;
    let forkedThreadId: string | null = null;
    let sideCreated = false;
    try {
      client = await this.deps.ensureAppServerAvailable();
      const read = await client.readConfig({ cwd: parent.projectPath, includeLayers: false });
      const config = normalizeConfig(read);
      const developerInstructions = appendPolicy(config.developer_instructions);
      const forkOptions: SideThreadForkOptions = {
        threadId: parent.threadId,
        cwd: parent.projectPath,
        model: parent.selectedModel ?? config.model ?? null,
        reasoningEffort: parent.selectedReasoningEffort ?? config.model_reasoning_effort ?? null,
        developerInstructions
      };
      const fork = await client.forkSideThread(forkOptions);
      forkedThreadId = fork.thread.id;
      await client.injectThreadItems(forkedThreadId, [{
        type: "message", role: "user", content: [{ type: "input_text", text: SIDE_BOUNDARY_PROMPT }]
      }]);
      const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: forkedThreadId });
      sideCreated = true;
      if (!this.getCardView(side)) {
        await this.deps.safeSendMessage(chatId, this.en(
          "Side is open, but its card could not be validated. Use /side to refresh it.",
          "Side 已开启，但卡片验证失败。请使用 /side 刷新。"));
        return;
      }
      await this.deps.syncCurrentSessionCard(chatId, "side_entered");
      const question = args.trim();
      if (question) {
        try {
          await this.deps.startTextTurn(chatId, side, question);
        } catch (error) {
          this.warn("side question submission failed", error);
          await this.deps.safeSendMessage(chatId, this.en(
            "Side is open, but your question was not submitted. Please send it again.",
            "Side 已开启，但问题未提交，请重新发送。"));
        }
      }
    } catch (error) {
      if (forkedThreadId && !sideCreated) {
        try { await client!.unsubscribeThread(forkedThreadId); }
        catch (cleanupError) { this.warn("failed to unsubscribe abandoned side thread", cleanupError); }
      }
      this.warn("side creation failed", error);
      if (sideCreated) await this.deps.safeSendMessage(chatId, this.en(
        "Side is open, but its card could not be refreshed. Use /side to refresh it.",
        "Side 已开启，但卡片刷新失败。请使用 /side 刷新。"));
      else if (isUnsupportedSideProtocol(error)) await this.sendUpdateRequired(chatId);
      else if (isStoreInvariantError(error)) await this.deps.safeSendMessage(chatId, this.en(
        "A Side conversation is already open or the session changed. Refresh the current session card.",
        "已有 Side 对话或会话状态已变化，请刷新当前会话卡片。"));
      else await this.deps.safeSendMessage(chatId, this.en(
        "Could not create the Side conversation. Your main session is unchanged.",
        "无法创建 Side 对话，主会话保持不变。"));
    }
  }

  private async sendUpdateRequired(chatId: string): Promise<void> {
    await this.deps.safeSendMessage(chatId, this.en(
      "Update Codex to 0.144.1 or later to use Side conversations. Other bridge features remain available.",
      "请将 Codex 更新到 0.144.1 或更高版本以使用 Side；其他桥接功能不受影响。"));
  }

  private en(english: string, chinese: string): string { return this.deps.getUiLanguage() === "en" ? english : chinese; }
  private warn(message: string, error: unknown): void { this.deps.logger?.warn(message, error); }
}

function normalizeConfig(value: ConfigReadResult): ConfigReadResult["config"] {
  return value?.config ?? {};
}

function appendPolicy(existing: string | null | undefined): string {
  return existing?.trim() ? `${existing}\n\n${SIDE_DEVELOPER_POLICY}` : SIDE_DEVELOPER_POLICY;
}

function meetsMinimumVersion(output: string): boolean {
  const match = output.trim().match(/^codex(?:-cli)?\s+(\d+)\.(\d+)\.(\d+)$/u);
  if (!match) return false;
  const actual = match.slice(1).map(Number);
  for (let index = 0; index < SIDE_MIN_CODEX_VERSION.length; index += 1) {
    const delta = (actual[index] ?? 0) - (SIDE_MIN_CODEX_VERSION[index] ?? 0);
    if (delta !== 0) return delta > 0;
  }
  return true;
}

function isUnsupportedSideProtocol(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown };
  if (value?.code === -32601) return true;
  const message = typeof value?.message === "string" ? value.message : String(error);
  return /method not found|unknown (?:field|parameter)|unsupported parameter/iu.test(message);
}

function isStoreInvariantError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /open side session|active chat binding|regular parent|parent does not exist/iu.test(message);
}
