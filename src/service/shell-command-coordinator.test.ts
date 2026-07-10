import assert from "node:assert/strict";
import test from "node:test";

import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import type { SessionRow } from "../types.js";
import { parseCallbackData } from "../telegram/ui.js";
import { ShellCommandCoordinator } from "./shell-command-coordinator.js";

function createSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    sessionId: overrides.sessionId ?? "session-1",
    chatId: overrides.chatId ?? "chat-1",
    telegramChatId: overrides.telegramChatId ?? overrides.chatId ?? "chat-1",
    threadId: "threadId" in overrides ? overrides.threadId ?? null : "thread-1",
    selectedModel: null,
    selectedReasoningEffort: null,
    planMode: false,
    needsDefaultCollaborationModeReset: false,
    displayName: "Session One",
    displayNameSource: "manual",
    projectName: "Project One",
    projectAlias: null,
    projectPath: overrides.projectPath ?? "/tmp/project-one",
    status: overrides.status ?? "idle",
    failureReason: null,
    archived: false,
    archivedAt: null,
    createdAt: "2026-07-10T00:00:00.000Z",
    lastUsedAt: "2026-07-10T00:00:00.000Z",
    lastTurnId: null,
    lastTurnStatus: "completed"
  };
}

function createHarness() {
  let activeSession: SessionRow | null = createSession();
  let now = 1_000;
  let ensuredThreadId = "thread-1";
  const shellCalls: Array<{ threadId: string; command: string }> = [];
  const messages: Array<{ chatId: string; text: string; replyMarkup?: TelegramInlineKeyboardMarkup }> = [];
  const coordinator = new ShellCommandCoordinator({
    getStore: () => ({
      getActiveSession: (chatId: string) => activeSession?.chatId === chatId ? activeSession : null
    }),
    ensureAppServerAvailable: async () => {},
    ensureSessionThread: async () => ensuredThreadId,
    getAppServer: () => ({
      runThreadShellCommand: async (threadId: string, command: string) => {
        shellCalls.push({ threadId, command });
      }
    }),
    safeSendMessage: async (chatId, text, replyMarkup) => {
      messages.push({ chatId, text, ...(replyMarkup ? { replyMarkup } : {}) });
      return true;
    },
    now: () => now,
    createToken: () => `token-${messages.length + 1}`
  });

  return {
    coordinator,
    shellCalls,
    messages,
    setActiveSession: (session: SessionRow | null) => { activeSession = session; },
    setEnsuredThreadId: (threadId: string) => { ensuredThreadId = threadId; },
    advanceTime: (milliseconds: number) => { now += milliseconds; }
  };
}

function confirmationToken(message: { replyMarkup?: TelegramInlineKeyboardMarkup }): string {
  const callback = message.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data ?? "";
  const parsed = parseCallbackData(callback);
  assert.equal(parsed?.kind, "shell_confirm");
  return parsed && "token" in parsed ? parsed.token : "";
}

test("direct bang commands execute against the active Codex thread", async () => {
  const harness = createHarness();

  await harness.coordinator.handleBangCommand("chat-1", "ls -la");

  assert.deepEqual(harness.shellCalls, [{ threadId: "thread-1", command: "ls -la" }]);
  assert.match(harness.messages.at(-1)?.text ?? "", /已开始执行/u);
});

test("bang commands require an active session and non-empty command", async () => {
  const harness = createHarness();
  harness.setActiveSession(null);

  await harness.coordinator.handleBangCommand("chat-1", "ls");
  assert.match(harness.messages.at(-1)?.text ?? "", /选择项目/u);

  harness.setActiveSession(createSession());
  await harness.coordinator.handleBangCommand("chat-1", "");
  assert.match(harness.messages.at(-1)?.text ?? "", /用法/u);
});

test("confirmation-required commands show exact command and cwd before execution", async () => {
  const harness = createHarness();

  await harness.coordinator.handleBangCommand("chat-1", "rm -rf build");

  assert.deepEqual(harness.shellCalls, []);
  const confirmation = harness.messages.at(-1);
  assert.match(confirmation?.text ?? "", /rm -rf build/u);
  assert.match(confirmation?.text ?? "", /\/tmp\/project-one/u);
  const token = confirmationToken(confirmation ?? {});

  assert.equal(await harness.coordinator.handleDecision("chat-1", token, true), "已开始执行。");
  assert.deepEqual(harness.shellCalls, [{ threadId: "thread-1", command: "rm -rf build" }]);
  assert.equal(await harness.coordinator.handleDecision("chat-1", token, true), "这个确认已失效。");
});

test("confirmation cancellation and expiry never execute commands", async () => {
  const canceled = createHarness();
  await canceled.coordinator.handleBangCommand("chat-1", "printf canceled");
  const canceledToken = confirmationToken(canceled.messages.at(-1) ?? {});
  assert.equal(await canceled.coordinator.handleDecision("chat-1", canceledToken, false), "已取消。");
  assert.deepEqual(canceled.shellCalls, []);

  const expired = createHarness();
  await expired.coordinator.handleBangCommand("chat-1", "printf expired");
  const expiredToken = confirmationToken(expired.messages.at(-1) ?? {});
  expired.advanceTime(120_001);
  assert.equal(await expired.coordinator.handleDecision("chat-1", expiredToken, true), "这个确认已过期。");
  assert.deepEqual(expired.shellCalls, []);
});

test("confirmation is bound to the original session and thread", async () => {
  const changedSession = createHarness();
  await changedSession.coordinator.handleBangCommand("chat-1", "printf session");
  const sessionToken = confirmationToken(changedSession.messages.at(-1) ?? {});
  changedSession.setActiveSession(createSession({ sessionId: "session-2" }));
  assert.match(await changedSession.coordinator.handleDecision("chat-1", sessionToken, true), /会话已改变/u);
  assert.deepEqual(changedSession.shellCalls, []);

  const changedThread = createHarness();
  await changedThread.coordinator.handleBangCommand("chat-1", "printf thread");
  const threadToken = confirmationToken(changedThread.messages.at(-1) ?? {});
  changedThread.setEnsuredThreadId("thread-2");
  assert.match(await changedThread.coordinator.handleDecision("chat-1", threadToken, true), /thread 已改变/u);
  assert.deepEqual(changedThread.shellCalls, []);
});

test("only one user shell command runs per thread at a time", async () => {
  const harness = createHarness();
  await harness.coordinator.handleBangCommand("chat-1", "ls");
  await harness.coordinator.handleBangCommand("chat-1", "pwd");

  assert.deepEqual(harness.shellCalls, [{ threadId: "thread-1", command: "ls" }]);
  assert.match(harness.messages.at(-1)?.text ?? "", /已有 shell 命令/u);
});

test("userShell notifications deliver bounded output and exit code", async () => {
  const harness = createHarness();
  await harness.coordinator.handleBangCommand("chat-1", "ls");

  await harness.coordinator.handleNotification("item/started", {
    threadId: "thread-1",
    turnId: "turn-shell",
    item: { id: "item-shell", type: "commandExecution", source: "userShell" }
  });
  await harness.coordinator.handleNotification("item/commandExecution/outputDelta", {
    threadId: "thread-1",
    turnId: "turn-shell",
    itemId: "item-shell",
    delta: "partial output\n"
  });
  await harness.coordinator.handleNotification("item/completed", {
    threadId: "thread-1",
    turnId: "turn-shell",
    item: {
      id: "item-shell",
      type: "commandExecution",
      source: "userShell",
      aggregatedOutput: `${"x".repeat(5_000)}\n`,
      exitCode: 7,
      status: "failed"
    }
  });

  const result = harness.messages.at(-1)?.text ?? "";
  assert.match(result, /Exit code: 7/u);
  assert.match(result, /输出已截断/u);
  assert.ok(result.length < 4_096);

  await harness.coordinator.handleBangCommand("chat-1", "pwd");
  assert.equal(harness.shellCalls.length, 2);
});
