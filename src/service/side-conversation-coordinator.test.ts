import assert from "node:assert/strict";
import test from "node:test";

import type { SessionRow } from "../types.js";
import {
  SIDE_ALLOWED_COMMANDS,
  SideConversationCoordinator
} from "./side-conversation-coordinator.js";

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    sessionId: "parent", sessionKind: "regular", parentSessionId: null, chatId: "chat",
    telegramChatId: "chat", threadId: "parent-thread", selectedModel: null,
    selectedReasoningEffort: null, planMode: false, needsDefaultCollaborationModeReset: false,
    displayName: "Main", displayNameSource: "auto", projectName: "Project", projectAlias: null,
    projectPath: "/project", status: "idle", failureReason: null, archived: false,
    archivedAt: null, createdAt: "2026-01-01", lastUsedAt: "2026-01-01", lastTurnId: null,
    lastTurnStatus: null, ...overrides
  };
}

function harness(options: { active?: SessionRow | null; version?: string | null; capacity?: boolean;
  parentNeedsAction?: boolean } = {}) {
  let active = options.active === undefined ? session() : options.active;
  const rows = new Map<string, SessionRow>();
  if (active) rows.set(active.sessionId, active);
  const events: string[] = [];
  const messages: string[] = [];
  const forkOptions: unknown[] = [];
  const injections: unknown[] = [];
  let tokenCount = 0;
  const store = {
    getActiveSession: (_chatId: string) => active,
    getSessionById: (id: string) => rows.get(id) ?? null,
    getSideParent: (id: string) => {
      const side = rows.get(id);
      return side?.parentSessionId ? rows.get(side.parentSessionId) ?? null : null;
    },
    getActiveSideForParent: (id: string) => {
      const current = active;
      return current?.sessionKind === "side" && current.parentSessionId === id ? current : null;
    },
    createSideSession: ({ parentSessionId, threadId }: { parentSessionId: string; threadId: string }) => {
      events.push("create-side");
      if (active?.sessionKind === "side") throw new Error("an open side session already exists for chat");
      const parent = rows.get(parentSessionId)!;
      const side = session({ ...parent, sessionId: "side", sessionKind: "side", parentSessionId, threadId,
        displayName: `Side: ${parent.displayName}`, status: "idle" });
      rows.set(side.sessionId, side); active = side; return side;
    },
    restoreParentAndDeleteSide: (sideSessionId: string) => {
      const side = rows.get(sideSessionId);
      const parent = side?.parentSessionId ? rows.get(side.parentSessionId) : null;
      if (!side || side.sessionKind !== "side" || !parent || active?.sessionId !== side.sessionId) return null;
      events.push("restore-parent"); active = parent; rows.delete(side.sessionId); return { side, parent };
    },
    restoreFallbackAndDeleteOrphanedSide: (sideSessionId: string) => {
      const side = rows.get(sideSessionId);
      if (!side || side.sessionKind !== "side" || active?.sessionId !== side.sessionId) return null;
      const fallback = [...rows.values()].filter((row) => row.sessionKind === "regular" && !row.archived && row.chatId === side.chatId)
        .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))[0] ?? null;
      events.push(fallback ? `restore-fallback:${fallback.sessionId}` : "restore-new");
      active = fallback; rows.delete(side.sessionId); return { side, fallback };
    }
  };
  const client = {
    readConfig: async () => { events.push("read-config"); return { config: {}, origins: {} }; },
    forkSideThread: async (value: unknown) => { events.push("fork"); forkOptions.push(value); return { thread: { id: "side-thread", turns: [] }, cwd: "/project", model: "m" }; },
    injectThreadItems: async (_id: string, value: unknown[]) => { events.push("inject"); injections.push(value); },
    unsubscribeThread: async (threadId: string) => { events.push(`unsubscribe:${threadId}`); },
    interruptTurn: async (threadId: string, turnId: string) => { events.push(`interrupt:${threadId}:${turnId}`); }
  };
  const deps = {
    getStore: () => store,
    ensureAppServerAvailable: async () => client,
    getCodexVersion: () => options.version === undefined ? "codex-cli 0.144.1" : options.version,
    getRunningTurnCapacity: () => ({ allowed: options.capacity ?? true, limit: 2, running: 0 }),
    getActiveTurn: (_sessionId: string): { threadId: string; turnId: string } | null => null,
    startTextTurn: async (_chatId: string, _side: SessionRow, text: string) => { events.push(`start:${text}`); },
    syncCurrentSessionCard: async (_chatId: string, reason: string) => { events.push(`sync:${reason}`); },
    surfacePendingInteractions: async (_chatId: string, id: string) => { events.push(`surface-interactions:${id}`); },
    expireSideInteractions: async (_chatId: string, id: string, reason: "side_closed") => { events.push(`expire-interactions:${id}:${reason}`); },
    clearSideTransientInput: (_chatId: string, id: string) => { events.push(`clear-transient-input:${id}`); },
    releaseHeldTerminalResults: async (_chatId: string, id: string) => { events.push(`release-results:${id}`); return 0; },
    getParentStatus: () => options.parentNeedsAction ? "waiting_approval" as const : "idle" as const,
    parentNeedsAction: () => options.parentNeedsAction ?? false, countHeldResults: () => 0,
    getUiLanguage: () => "en" as const,
    safeSendMessage: async (_chatId: string, text: string) => { messages.push(text); return true; },
    safeSendHtmlMessage: async (_chatId: string, text: string) => { messages.push(text); return true; },
    nowMs: () => 1, createToken: () => `token-${++tokenCount}`
  };
  return { coordinator: new SideConversationCoordinator(deps), deps, client, store, rows, events, messages, forkOptions, injections,
    get active() { return active; }, setActive(value: SessionRow | null) { active = value; if (value) rows.set(value.sessionId, value); } };
}

test("reports no active session when store or parent is unavailable", async () => {
  const h = harness({ active: null });
  await h.coordinator.handleCommand("chat", "");
  assert.match(h.messages.at(-1) ?? "", /no active session/i);
  const noStore = new SideConversationCoordinator({ ...h.deps, getStore: () => null });
  await noStore.handleCommand("chat", "");
  assert.match(h.messages.at(-1) ?? "", /no active session/i);
});

async function enterSide(h: ReturnType<typeof harness>): Promise<string> {
  await h.coordinator.handleCommand("chat", "");
  h.events.length = 0;
  return h.coordinator.getCardView(h.active!)!.token;
}

test("idle side back restores parent and releases parent surfaces in order", async () => {
  const h = harness();
  const token = await enterSide(h);
  await h.coordinator.handleCardAction("chat", "back", token);
  assert.deepEqual(h.events, [
    "expire-interactions:side:side_closed", "clear-transient-input:side", "unsubscribe:side-thread", "restore-parent", "sync:side_returned",
    "surface-interactions:parent", "release-results:parent"
  ]);
  assert.equal(h.active?.sessionId, "parent");
  assert.equal(h.rows.has("side"), false);
});

test("slash side back uses the same idle return path", async () => {
  const h = harness(); await enterSide(h);
  await h.coordinator.handleCommand("chat", " back ");
  assert.equal(h.active?.sessionId, "parent");
  assert.deepEqual(h.events, ["expire-interactions:side:side_closed", "clear-transient-input:side", "unsubscribe:side-thread", "restore-parent", "sync:side_returned",
    "surface-interactions:parent", "release-results:parent"]);
});

test("running side back confirms without interrupting and cancel preserves side", async () => {
  const h = harness(); const cardToken = await enterSide(h);
  h.deps.getActiveTurn = () => ({ threadId: "side-thread", turnId: "side-turn" });
  const confirmToken = await h.coordinator.handleCardAction("chat", "back", cardToken);
  assert.deepEqual(h.events, []);
  assert.match(h.messages.at(-1) ?? "", /interrupt.*running side/i);
  await h.coordinator.handleCardAction("chat", "return_cancel", confirmToken!);
  assert.equal(h.active?.sessionId, "side"); assert.deepEqual(h.events, ["sync:side_return_cancelled"]);
});

test("confirmed running return preserves cleanup and restore order", async () => {
  const h = harness(); const cardToken = await enterSide(h);
  h.deps.getActiveTurn = () => ({ threadId: "side-thread", turnId: "side-turn" });
  const confirmToken = await h.coordinator.handleCardAction("chat", "back", cardToken);
  await h.coordinator.handleCardAction("chat", "return_confirm", confirmToken!);
  assert.deepEqual(h.events, [
    "interrupt:side-thread:side-turn", "expire-interactions:side:side_closed", "clear-transient-input:side",
    "unsubscribe:side-thread", "restore-parent", "sync:side_returned",
    "surface-interactions:parent", "release-results:parent"
  ]);
  const completedEvents = [...h.events];
  await h.coordinator.handleCardAction("chat", "return_confirm", confirmToken!);
  assert.deepEqual(h.events, completedEvents);
  assert.equal(h.messages.at(-1), "这个 Side 操作已失效。");
});

test("completed side turn between confirmation and confirm skips interrupt", async () => {
  const h = harness(); const cardToken = await enterSide(h); let running = true;
  h.deps.getActiveTurn = () => running ? { threadId: "side-thread", turnId: "side-turn" } : null;
  const confirmToken = await h.coordinator.handleCardAction("chat", "back", cardToken); running = false;
  await h.coordinator.handleCardAction("chat", "return_confirm", confirmToken!);
  assert.equal(h.events.some((event) => event.startsWith("interrupt:")), false);
  assert.equal(h.active?.sessionId, "parent");
});

test("interrupt and unsubscribe failures keep side active", async () => {
  for (const failure of ["interrupt", "unsubscribe"] as const) {
    const h = harness(); const cardToken = await enterSide(h);
    h.deps.getActiveTurn = () => ({ threadId: "side-thread", turnId: "side-turn" });
    if (failure === "interrupt") h.client.interruptTurn = async () => { throw new Error("no"); };
    else h.client.unsubscribeThread = async () => { throw new Error("no"); };
    const confirmToken = await h.coordinator.handleCardAction("chat", "back", cardToken);
    await h.coordinator.handleCardAction("chat", "return_confirm", confirmToken!);
    assert.equal(h.active?.sessionId, "side"); assert.equal(h.rows.has("side"), true);
    assert.match(h.messages.at(-1) ?? "", /could not return|return did not complete/i);
  }
});

test("confirmation tokens are chat-bound expiring single-use and stale card tokens are harmless", async () => {
  const h = harness(); const cardToken = await enterSide(h);
  h.deps.getActiveTurn = () => ({ threadId: "side-thread", turnId: "side-turn" });
  const confirmToken = await h.coordinator.handleCardAction("chat", "back", cardToken);
  await h.coordinator.handleCardAction("wrong-chat", "return_confirm", confirmToken!);
  assert.equal(h.messages.at(-1), "这个 Side 操作已失效。"); assert.deepEqual(h.events, []);
  await h.coordinator.handleCardAction("chat", "return_confirm", confirmToken!);
  assert.equal(h.messages.at(-1), "这个 Side 操作已失效。"); assert.deepEqual(h.events, []);

  await h.coordinator.handleCardAction("chat", "status", "stale-card");
  assert.equal(h.messages.at(-1), "这个 Side 操作已失效。"); assert.deepEqual(h.events, []);

  const expiring = harness(); const expiringCard = await enterSide(expiring);
  expiring.deps.getActiveTurn = () => ({ threadId: "side-thread", turnId: "turn" });
  let now = 1; expiring.deps.nowMs = () => now;
  const coordinator = new SideConversationCoordinator(expiring.deps);
  const reboundToken = coordinator.getCardView(expiring.active!)!.token;
  const expiringToken = await coordinator.handleCardAction("chat", "back", reboundToken); now = 120_002;
  await coordinator.handleCardAction("chat", "return_confirm", expiringToken!);
  assert.equal(expiring.messages.at(-1), "这个 Side 操作已失效。"); assert.equal(expiring.active?.sessionId, "side");
  void expiringCard;
});

test("parent status is read-only and interrupt action targets only the side turn", async () => {
  const h = harness(); const token = await enterSide(h);
  h.deps.getActiveTurn = () => ({ threadId: "side-thread", turnId: "side-turn" });
  await h.coordinator.handleCardAction("chat", "status", token);
  assert.match(h.messages.at(-1) ?? "", /parent task status/i); assert.deepEqual(h.events, []);
  await h.coordinator.handleCardAction("chat", "interrupt", token);
  assert.deepEqual(h.events, ["interrupt:side-thread:side-turn"]); assert.equal(h.active?.sessionId, "side");
});

test("missing parent return closes side and activates the most recent regular fallback", async () => {
  const h = harness(); const cardToken = await enterSide(h);
  h.rows.set("fallback-old", session({ sessionId: "fallback-old", threadId: "old", lastUsedAt: "2026-01-02" }));
  h.rows.set("fallback-new", session({ sessionId: "fallback-new", threadId: "new", lastUsedAt: "2026-01-03" }));
  h.rows.delete("parent");
  await h.coordinator.handleCardAction("chat", "back", cardToken);
  assert.equal(h.active?.sessionId, "fallback-new"); assert.equal(h.rows.has("side"), false);
  assert.deepEqual(h.events, ["expire-interactions:side:side_closed", "clear-transient-input:side",
    "unsubscribe:side-thread", "restore-fallback:fallback-new", "sync:side_returned",
    "surface-interactions:fallback-new", "release-results:fallback-new"]);
});

test("missing parent without fallback closes side and returns the chat to new-session state", async () => {
  const h = harness(); const cardToken = await enterSide(h); h.rows.delete("parent");
  await h.coordinator.handleCardAction("chat", "back", cardToken);
  assert.equal(h.active, null); assert.equal(h.rows.has("side"), false);
  assert.deepEqual(h.events, ["expire-interactions:side:side_closed", "clear-transient-input:side",
    "unsubscribe:side-thread", "restore-new", "sync:side_returned"]);
});

test("active side cannot nest and refreshes its card", async () => {
  const parent = session();
  const side = session({ sessionId: "side", sessionKind: "side", parentSessionId: parent.sessionId, threadId: "side-thread" });
  const h = harness({ active: side }); h.rows.set(parent.sessionId, parent);
  await h.coordinator.handleCommand("chat", "question");
  assert.deepEqual(h.events, ["sync:side_entered"]);
  assert.match(h.messages.join(" "), /already.*side|nest/i);
});

test("requires materialized parent thread before capability calls", async () => {
  const h = harness({ active: session({ threadId: null }) });
  await h.coordinator.handleCommand("chat", "");
  assert.deepEqual(h.events, []); assert.match(h.messages[0] ?? "", /complete.*first task/i);
});

test("version gate rejects old and malformed explicit versions, accepts minimum and probes unknown", async () => {
  for (const version of ["codex-cli 0.144.0", "not-a-version"]) {
    const h = harness({ version }); await h.coordinator.handleCommand("chat", "");
    assert.deepEqual(h.events, []); assert.match(h.messages[0] ?? "", /update codex/i);
  }
  for (const version of ["codex-cli 0.144.1", "codex-cli 1.0.0", null]) {
    const h = harness({ version }); await h.coordinator.handleCommand("chat", "");
    assert.ok(h.events.includes("fork"));
  }
});

test("version parser accepts only recognized whole Codex version output", async () => {
  for (const version of ["codex-cli 0.144.1", "codex 0.144.1", "  codex-cli 1.2.3\n"]) {
    const h = harness({ version }); await h.coordinator.handleCommand("chat", "");
    assert.ok(h.events.includes("fork"));
  }
  for (const version of ["garbage 1.0.0 garbage", "codex-cli 0.144.1 suffix", "prefix codex 0.144.1"]) {
    const h = harness({ version }); await h.coordinator.handleCommand("chat", "");
    assert.deepEqual(h.events, []); assert.match(h.messages[0] ?? "", /update codex/i);
  }
});

test("capacity refuses before config or fork", async () => {
  const h = harness({ capacity: false }); await h.coordinator.handleCommand("chat", "");
  assert.deepEqual(h.events, []); assert.match(h.messages[0] ?? "", /capacity|running/i);
});

test("idle, running, and failed parents create; bare waits and inline starts after activation", async () => {
  for (const status of ["idle", "running", "failed"] as const) {
    const h = harness({ active: session({ status }) });
    await h.coordinator.handleCommand("chat", status === "running" ? " explain this failure " : "");
    assert.deepEqual(h.events, status === "running"
      ? ["read-config", "fork", "inject", "create-side", "sync:side_entered", "start:explain this failure"]
      : ["read-config", "fork", "inject", "create-side", "sync:side_entered"]);
  }
});

test("blocked parent waiting for approval still creates a side", async () => {
  const h = harness({ active: session({ status: "running" }), parentNeedsAction: true });
  await h.coordinator.handleCommand("chat", "");
  assert.ok(h.events.includes("create-side"));
});

test("config instructions and effective model/effort are passed to fork; boundary is injected", async () => {
  const h = harness({ active: session({ selectedModel: "selected", selectedReasoningEffort: "high" }) });
  h.client.readConfig = async () => ({ config: { model: "fallback", model_reasoning_effort: "low" as const,
    developer_instructions: "existing" }, origins: {} });
  await h.coordinator.handleCommand("chat", "");
  const fork = h.forkOptions[0] as any;
  assert.equal(fork.threadId, "parent-thread"); assert.equal(fork.cwd, "/project");
  assert.equal(fork.model, "selected"); assert.equal(fork.reasoningEffort, "high");
  assert.ok(fork.developerInstructions.startsWith("existing\n\nSIDE CONVERSATION SAFETY POLICY:"));
  for (const phrase of [/inherited history.*reference context only/i, /only post-boundary messages are active/i,
    /do not continue inherited tasks, plans, tool calls, or approvals/i, /separate side assistant.*lightweight exploration/i,
    /do not use subagents|subagents are off-limits/i, /do not make mutations unless explicitly requested/i,
    /do not escalate unless an explicit mutation/i]) assert.match(fork.developerInstructions, phrase);
  const rawItem = (h.injections[0] as any[])[0];
  assert.equal(rawItem.type, "message"); assert.equal(rawItem.role, "user");
  const boundary = rawItem.content[0].text as string;
  for (const phrase of [/inherited history.*reference context only/i, /only messages after this boundary are active/i,
    /do not continue inherited tasks, plans, tool calls, or approvals/i, /separate side assistant.*lightweight exploration/i,
    /subagents are off-limits|do not use subagents/i, /do not mutate anything unless explicitly requested/i,
    /do not escalate unless an explicit mutation/i]) assert.match(boundary, phrase);
  const fallback = harness();
  fallback.client.readConfig = async () => ({ config: { model: "fallback", model_reasoning_effort: "low" as const, developer_instructions: "  " }, origins: {} });
  await fallback.coordinator.handleCommand("chat", "");
  assert.equal((fallback.forkOptions[0] as any).model, "fallback");
  assert.equal((fallback.forkOptions[0] as any).reasoningEffort, "low");
  assert.ok(!(fallback.forkOptions[0] as any).developerInstructions.startsWith("\n"));
});

test("fork and inject failures preserve parent; inject unsubscribes best effort", async () => {
  const fork = harness(); fork.client.forkSideThread = async () => { throw new Error("boom"); };
  await fork.coordinator.handleCommand("chat", ""); assert.equal(fork.active?.sessionId, "parent"); assert.equal(fork.rows.has("side"), false);
  const inject = harness(); inject.client.injectThreadItems = async () => { throw new Error("boom"); };
  await inject.coordinator.handleCommand("chat", ""); assert.deepEqual(inject.events, ["read-config", "fork", "unsubscribe:side-thread"]);
  assert.equal(inject.active?.sessionId, "parent");
  const cleanup = harness(); cleanup.client.injectThreadItems = async () => { throw new Error("boom"); };
  cleanup.client.unsubscribeThread = async () => { cleanup.events.push("unsubscribe"); throw new Error("cleanup"); };
  await cleanup.coordinator.handleCommand("chat", ""); assert.equal(cleanup.active?.sessionId, "parent"); assert.match(cleanup.messages.at(-1) ?? "", /could not create/i);
});

test("store invariant failure is clear and does not change active parent", async () => {
  const h = harness();
  h.store.createSideSession = () => { throw new Error("an open side session already exists for chat"); };
  await h.coordinator.handleCommand("chat", "");
  assert.equal(h.active?.sessionId, "parent"); assert.equal(h.rows.has("side"), false);
  assert.ok(h.events.includes("unsubscribe:side-thread")); assert.match(h.messages.at(-1) ?? "", /already open|session changed/i);
});

test("generic persistence failure unsubscribes fork and preserves parent", async () => {
  const h = harness(); h.store.createSideSession = () => { throw new Error("disk unavailable"); };
  await h.coordinator.handleCommand("chat", "");
  assert.equal(h.active?.sessionId, "parent"); assert.equal(h.rows.has("side"), false);
  assert.ok(h.events.includes("unsubscribe:side-thread")); assert.match(h.messages.at(-1) ?? "", /could not create/i);
});

test("token or card sync failure after persistence keeps the active side and does not unsubscribe", async () => {
  const token = harness(); token.deps.createToken = () => { throw new Error("token failed"); };
  await new SideConversationCoordinator(token.deps).handleCommand("chat", "");
  assert.equal(token.active?.sessionKind, "side"); assert.equal(token.events.includes("unsubscribe"), false);
  assert.match(token.messages.at(-1) ?? "", /side is open.*card/i);

  const sync = harness(); sync.deps.syncCurrentSessionCard = async () => { throw new Error("sync failed"); };
  await new SideConversationCoordinator(sync.deps).handleCommand("chat", "");
  assert.equal(sync.active?.sessionKind, "side"); assert.equal(sync.events.includes("unsubscribe"), false);
  assert.match(sync.messages.at(-1) ?? "", /side is open.*card/i);
});

test("null card validation after persistence stops sync and inline turn while preserving side", async () => {
  const h = harness();
  const originalCreate = h.store.createSideSession;
  h.store.createSideSession = (options) => {
    const side = originalCreate(options);
    h.store.getSessionById = (id: string) => id === side.sessionId ? null : h.rows.get(id) ?? null;
    return side;
  };
  await h.coordinator.handleCommand("chat", "do not submit");
  assert.equal(h.active?.sessionKind, "side");
  assert.equal(h.events.includes("sync:side_entered"), false);
  assert.equal(h.events.some((event) => event.startsWith("start:")), false);
  assert.equal(h.events.includes("unsubscribe"), false);
  assert.match(h.messages.at(-1) ?? "", /side is open.*card/i);
});

test("protocol errors are classified as side-only update requirements", async () => {
  for (const error of [Object.assign(new Error("rpc"), { code: -32601 }), new Error("unsupported parameter ephemeral")]) {
    const h = harness({ version: null }); h.client.forkSideThread = async () => { throw error; };
    await h.coordinator.handleCommand("chat", ""); assert.match(h.messages.at(-1) ?? "", /update codex.*side/i);
  }
});

test("start failure leaves created side active and idle", async () => {
  const h = harness(); h.deps.startTextTurn = async () => { throw new Error("start failed"); };
  const coordinator = new SideConversationCoordinator(h.deps);
  await coordinator.handleCommand("chat", "question");
  assert.equal(h.active?.sessionKind, "side"); assert.equal(h.active?.status, "idle");
  assert.match(h.messages.at(-1) ?? "", /not submitted/i);
});

test("per-chat queue permits at most one fork", async () => {
  const h = harness(); let release!: () => void;
  h.client.readConfig = async () => { await new Promise<void>((resolve) => { release = resolve; }); return { config: {}, origins: {} }; };
  const first = h.coordinator.handleCommand("chat", "");
  await new Promise((resolve) => setImmediate(resolve));
  const second = h.coordinator.handleCommand("chat", ""); release(); await Promise.all([first, second]);
  assert.equal(h.events.filter((event) => event === "fork").length, 1);
});

test("same-chat queue continues after the first creation attempt fails", async () => {
  const h = harness(); let attempts = 0;
  let messageAttempts = 0;
  h.deps.safeSendMessage = async () => {
    messageAttempts += 1;
    if (messageAttempts === 1) throw new Error("failure report rejected");
    return true;
  };
  h.client.forkSideThread = async (options: unknown) => {
    attempts += 1; h.events.push("fork"); h.forkOptions.push(options);
    if (attempts === 1) throw new Error("first failed");
    return { thread: { id: "side-thread", turns: [] }, cwd: "/project", model: "m" };
  };
  const results = await Promise.allSettled([
    h.coordinator.handleCommand("chat", ""), h.coordinator.handleCommand("chat", "")
  ]);
  assert.equal(results[0]?.status, "rejected");
  assert.equal(results[1]?.status, "fulfilled");
  assert.equal(attempts, 2); assert.equal(h.active?.sessionKind, "side");
});

test("different chat queues progress independently", async () => {
  const first = session({ chatId: "chat-1", telegramChatId: "chat-1", sessionId: "p1", threadId: "t1", projectPath: "/one" });
  const second = session({ chatId: "chat-2", telegramChatId: "chat-2", sessionId: "p2", threadId: "t2", projectPath: "/two" });
  const active = new Map([["chat-1", first], ["chat-2", second]]);
  const rows = new Map([[first.sessionId, first], [second.sessionId, second]]);
  let release!: () => void; let firstReadStarted!: () => void;
  const started = new Promise<void>((resolve) => { firstReadStarted = resolve; });
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const completed: string[] = [];
  const store = {
    getActiveSession: (chatId: string) => active.get(chatId) ?? null,
    getSessionById: (id: string) => rows.get(id) ?? null,
    getSideParent: (id: string) => { const side = rows.get(id); return side?.parentSessionId ? rows.get(side.parentSessionId) ?? null : null; },
    getActiveSideForParent: (id: string) => [...active.values()].find((row) => row.sessionKind === "side" && row.parentSessionId === id) ?? null,
    createSideSession: ({ parentSessionId, threadId }: { parentSessionId: string; threadId: string }) => {
      const parent = rows.get(parentSessionId)!; const side = session({ ...parent, sessionId: `s-${parentSessionId}`,
        sessionKind: "side", parentSessionId, threadId }); rows.set(side.sessionId, side); active.set(parent.chatId, side); return side;
    },
    restoreParentAndDeleteSide: (sideSessionId: string) => {
      const side = rows.get(sideSessionId); const parent = side?.parentSessionId ? rows.get(side.parentSessionId) : null;
      if (!side || !parent || active.get(side.chatId)?.sessionId !== side.sessionId) return null;
      active.set(side.chatId, parent); rows.delete(side.sessionId); return { side, parent };
    },
    restoreFallbackAndDeleteOrphanedSide: () => null
  };
  const coordinator = new SideConversationCoordinator({
    getStore: () => store,
    ensureAppServerAvailable: async () => ({
      readConfig: async ({ cwd } = {}) => { if (cwd === "/one") { firstReadStarted(); await blocked; } return { config: {}, origins: {} }; },
      forkSideThread: async ({ threadId }) => ({ thread: { id: `side-${threadId}`, turns: [] }, cwd: "", model: "m" }),
      injectThreadItems: async () => undefined, unsubscribeThread: async () => undefined, interruptTurn: async () => undefined
    }),
    getCodexVersion: () => "codex-cli 0.144.1", getRunningTurnCapacity: () => ({ allowed: true, limit: 2, running: 0 }),
    getActiveTurn: () => null, startTextTurn: async () => undefined,
    syncCurrentSessionCard: async (chatId) => { completed.push(chatId); },
    surfacePendingInteractions: async () => undefined, expireSideInteractions: async () => undefined,
    clearSideTransientInput: () => undefined, releaseHeldTerminalResults: async () => 0,
    getParentStatus: () => "idle", parentNeedsAction: () => false, countHeldResults: () => 0,
    getUiLanguage: () => "en", safeSendMessage: async () => true, safeSendHtmlMessage: async () => true,
    nowMs: () => 0, createToken: () => Math.random().toString(36)
  });
  const one = coordinator.handleCommand("chat-1", ""); await started;
  const two = coordinator.handleCommand("chat-2", ""); await two;
  assert.deepEqual(completed, ["chat-2"]); release(); await one;
  assert.deepEqual(completed, ["chat-2", "chat-1"]);
});

test("allowlist, parent hold, and stable validated card view", async () => {
  const h = harness(); await h.coordinator.handleCommand("chat", "");
  for (const command of SIDE_ALLOWED_COMMANDS) assert.equal(h.coordinator.isCommandAllowed(command), true);
  assert.equal(h.coordinator.isCommandAllowed("Status"), false); assert.equal(h.coordinator.isCommandAllowed("help"), false);
  assert.equal(h.coordinator.isParentSurfaceHeld("parent"), true);
  assert.equal(new SideConversationCoordinator({ ...h.deps, getStore: () => null }).isParentSurfaceHeld("parent"), false);
  const first = h.coordinator.getCardView(h.active!); const second = h.coordinator.getCardView(h.active!);
  assert.equal(first?.token, "token-1"); assert.equal(second?.token, first?.token);
  assert.deepEqual(first && { language: first.language, projectName: first.projectName, parentSessionName: first.parentSessionName,
    sideStatus: first.sideStatus, parentStatus: first.parentStatus, parentNeedsAction: first.parentNeedsAction,
    heldResultCount: first.heldResultCount }, { language: "en", projectName: "Project", parentSessionName: "Main",
    sideStatus: "idle", parentStatus: "idle", parentNeedsAction: false, heldResultCount: 0 });
  assert.equal(h.coordinator.getCardView(session({ sessionId: "fake", sessionKind: "side", parentSessionId: "parent", chatId: "other" })), null);
});

test("card view treats caller as an id only and derives all fields from persisted state", async () => {
  const h = harness(); await h.coordinator.handleCommand("chat", "");
  const forged = session({ ...h.active!, projectName: "FORGED", status: "failed", chatId: "wrong-chat",
    telegramChatId: "wrong-chat", projectPath: "/wrong", selectedModel: "wrong" });
  const view = h.coordinator.getCardView(forged);
  assert.equal(view?.projectName, "Project"); assert.equal(view?.sideStatus, "idle");
  assert.equal(view?.token, "token-1");
});

test("card view rejects corrupt persisted side-parent project relation", async () => {
  const h = harness(); await h.coordinator.handleCommand("chat", "");
  h.rows.set("side", session({ ...h.active!, projectPath: "/corrupt" }));
  assert.equal(h.coordinator.getCardView(h.active!), null);
});

test("card view does not mint a token for a valid but nonactive historical side", async () => {
  const h = harness(); await h.coordinator.handleCommand("chat", ""); const historical = h.active!;
  h.setActive(session());
  const coordinator = new SideConversationCoordinator({ ...h.deps, createToken: () => { throw new Error("must not mint"); } });
  assert.equal(coordinator.getCardView(historical), null);
});

test("parent surface hold validates the complete active side relationship", () => {
  const parent = session();
  const malformedSide = session({ sessionId: "bad-side", sessionKind: "regular", parentSessionId: parent.sessionId });
  const h = harness({ active: parent }); h.rows.set(malformedSide.sessionId, malformedSide);
  const malformedStore = { ...h.store, getActiveSideForParent: () => malformedSide };
  assert.equal(new SideConversationCoordinator({ ...h.deps, getStore: () => malformedStore }).isParentSurfaceHeld(parent.sessionId), false);

  const wrongParentSide = session({ sessionId: "side", sessionKind: "side", parentSessionId: "other" });
  h.rows.set(wrongParentSide.sessionId, wrongParentSide);
  const staleStore = { ...h.store, getActiveSideForParent: () => wrongParentSide, getSideParent: () => parent };
  assert.equal(new SideConversationCoordinator({ ...h.deps, getStore: () => staleStore }).isParentSurfaceHeld(parent.sessionId), false);

  const wrongScopeSide = session({ sessionId: "scoped-side", sessionKind: "side", parentSessionId: parent.sessionId,
    chatId: "other-chat", projectPath: "/other" });
  h.rows.set(wrongScopeSide.sessionId, wrongScopeSide);
  const wrongScopeStore = { ...h.store, getActiveSideForParent: () => wrongScopeSide, getSideParent: () => parent };
  assert.equal(new SideConversationCoordinator({ ...h.deps, getStore: () => wrongScopeStore }).isParentSurfaceHeld(parent.sessionId), false);
});
