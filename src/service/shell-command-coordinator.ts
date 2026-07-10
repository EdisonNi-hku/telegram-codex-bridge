import { randomBytes } from "node:crypto";

import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import {
  encodeShellCancelCallback,
  encodeShellConfirmCallback
} from "../telegram/ui.js";
import type { SessionRow } from "../types.js";
import { getNumber, getObject, getString } from "../util/untyped.js";
import { classifyShellCommand } from "./shell-command-policy.js";

const CONFIRMATION_TTL_MS = 120_000;
const RESULT_MESSAGE_LIMIT = 4_000;
const OUTPUT_PREVIEW_LIMIT = 3_300;
const COLLECTED_OUTPUT_LIMIT = 64_000;

interface ShellSessionStore {
  getActiveSession(chatId: string): SessionRow | null;
}

interface ShellAppServer {
  runThreadShellCommand(threadId: string, command: string): Promise<void>;
}

export interface ShellCommandCoordinatorDeps {
  getStore(): ShellSessionStore | null;
  ensureAppServerAvailable(): Promise<void>;
  ensureSessionThread(session: SessionRow): Promise<string>;
  getAppServer(): ShellAppServer | null;
  safeSendMessage(
    chatId: string,
    text: string,
    replyMarkup?: TelegramInlineKeyboardMarkup
  ): Promise<boolean>;
  now?: () => number;
  createToken?: () => string;
}

interface PendingShellConfirmation {
  chatId: string;
  sessionId: string;
  threadId: string;
  command: string;
  expiresAt: number;
}

interface RunningShellCommand {
  chatId: string;
  sessionId: string;
  threadId: string;
  command: string;
  itemId: string | null;
  output: string;
}

export class ShellCommandCoordinator {
  private readonly pendingByToken = new Map<string, PendingShellConfirmation>();
  private readonly runningByThreadId = new Map<string, RunningShellCommand>();
  private readonly now: () => number;
  private readonly createToken: () => string;

  constructor(private readonly deps: ShellCommandCoordinatorDeps) {
    this.now = deps.now ?? Date.now;
    this.createToken = deps.createToken ?? (() => randomBytes(9).toString("base64url"));
  }

  async handleBangCommand(chatId: string, command: string): Promise<void> {
    if (!command) {
      await this.deps.safeSendMessage(chatId, "用法：!<command>，例如 !ls");
      return;
    }

    const session = this.deps.getStore()?.getActiveSession(chatId) ?? null;
    if (!session) {
      await this.deps.safeSendMessage(chatId, "请先发送 /new 选择项目。");
      return;
    }

    try {
      await this.deps.ensureAppServerAvailable();
      const threadId = await this.deps.ensureSessionThread(session);
      if (this.runningByThreadId.has(threadId)) {
        await this.deps.safeSendMessage(chatId, "当前会话已有 shell 命令正在执行，请等待完成。");
        return;
      }

      const risk = classifyShellCommand(command);
      if (risk.decision === "confirm") {
        await this.requestConfirmation(chatId, session, threadId, command, risk.reason);
        return;
      }

      await this.submit(chatId, session.sessionId, threadId, command);
    } catch {
      await this.deps.safeSendMessage(chatId, "Codex shell 暂时不可用，请稍后重试。");
    }
  }

  async handleDecision(chatId: string, token: string, approved: boolean): Promise<string> {
    const pending = this.pendingByToken.get(token);
    this.pendingByToken.delete(token);
    if (!pending || pending.chatId !== chatId) {
      return "这个确认已失效。";
    }

    if (this.now() > pending.expiresAt) {
      return "这个确认已过期。";
    }

    if (!approved) {
      return "已取消。";
    }

    const session = this.deps.getStore()?.getActiveSession(chatId) ?? null;
    if (!session || session.sessionId !== pending.sessionId) {
      return "当前会话已改变，未执行命令。";
    }

    try {
      await this.deps.ensureAppServerAvailable();
      const threadId = await this.deps.ensureSessionThread(session);
      if (threadId !== pending.threadId) {
        return "Codex thread 已改变，未执行命令。";
      }
      if (this.runningByThreadId.has(threadId)) {
        return "当前会话已有 shell 命令正在执行。";
      }

      await this.submit(chatId, session.sessionId, threadId, pending.command);
      return "已开始执行。";
    } catch {
      return "Codex shell 暂时不可用。";
    }
  }

  async handleNotification(method: string, params: unknown): Promise<void> {
    const threadId = getString(params, "threadId");
    if (!threadId) {
      return;
    }

    const running = this.runningByThreadId.get(threadId);
    if (!running) {
      return;
    }

    if (method === "item/started") {
      const item = getObject(params)?.item;
      if (getString(item, "type") !== "commandExecution" || getString(item, "source") !== "userShell") {
        return;
      }
      running.itemId = getString(item, "id");
      return;
    }

    if (method === "item/commandExecution/outputDelta") {
      const itemId = getString(params, "itemId");
      if (running.itemId && itemId !== running.itemId) {
        return;
      }
      running.output = appendBounded(running.output, getString(params, "delta") ?? "", COLLECTED_OUTPUT_LIMIT);
      return;
    }

    if (method !== "item/completed") {
      return;
    }

    const item = getObject(params)?.item;
    if (getString(item, "type") !== "commandExecution" || getString(item, "source") !== "userShell") {
      return;
    }

    const itemId = getString(item, "id");
    if (running.itemId && itemId !== running.itemId) {
      return;
    }

    this.runningByThreadId.delete(threadId);
    const output = getString(item, "aggregatedOutput") ?? running.output;
    const exitCode = getNumber(item, "exitCode");
    await this.deps.safeSendMessage(
      running.chatId,
      buildShellResultMessage(running.command, output, exitCode)
    );
  }

  private async requestConfirmation(
    chatId: string,
    session: SessionRow,
    threadId: string,
    command: string,
    reason: string
  ): Promise<void> {
    const token = this.createToken();
    this.pendingByToken.set(token, {
      chatId,
      sessionId: session.sessionId,
      threadId,
      command,
      expiresAt: this.now() + CONFIRMATION_TTL_MS
    });

    await this.deps.safeSendMessage(
      chatId,
      [
        "⚠️ 这个 shell 命令需要确认",
        `原因：${reason}`,
        `目录：${session.projectPath}`,
        "命令：",
        command
      ].join("\n"),
      buildConfirmationReplyMarkup(token)
    );
  }

  private async submit(
    chatId: string,
    sessionId: string,
    threadId: string,
    command: string
  ): Promise<void> {
    const appServer = this.deps.getAppServer();
    if (!appServer) {
      throw new Error("app-server unavailable");
    }

    this.runningByThreadId.set(threadId, {
      chatId,
      sessionId,
      threadId,
      command,
      itemId: null,
      output: ""
    });

    try {
      await appServer.runThreadShellCommand(threadId, command);
    } catch (error) {
      this.runningByThreadId.delete(threadId);
      throw error;
    }

    await this.deps.safeSendMessage(chatId, `已开始执行：!${command}`);
  }
}

function buildConfirmationReplyMarkup(token: string): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "确认执行", callback_data: encodeShellConfirmCallback(token), style: "primary" },
      { text: "取消", callback_data: encodeShellCancelCallback(token) }
    ]]
  };
}

function appendBounded(current: string, addition: string, limit: number): string {
  if (current.length >= limit) {
    return current;
  }
  return `${current}${addition}`.slice(0, limit);
}

function buildShellResultMessage(command: string, output: string, exitCode: number | null): string {
  const normalizedOutput = output.trimEnd() || "(no output)";
  const truncated = normalizedOutput.length > OUTPUT_PREVIEW_LIMIT;
  const preview = truncated
    ? `${normalizedOutput.slice(0, OUTPUT_PREVIEW_LIMIT)}\n…输出已截断…`
    : normalizedOutput;
  const message = [`$ ${command}`, "", preview, "", `Exit code: ${exitCode ?? "unknown"}`].join("\n");
  return message.slice(0, RESULT_MESSAGE_LIMIT);
}
