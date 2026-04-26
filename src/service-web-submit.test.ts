import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { BridgeService } from "./service.js";
import type { SessionRow } from "./types.js";

const idSalt = "web-readonly-view-model:v1";

function conversationHandleForSessionId(sessionId: string): string {
  return `cv_${createHash("sha256").update(idSalt).update("\0").update(sessionId).digest("hex").slice(0, 16)}`;
}

function sessionFixture(patch: Partial<SessionRow> = {}): SessionRow {
  return {
    sessionId: "session-1",
    chatId: "chat-1",
    telegramChatId: "chat-1",
    threadId: "thread-1",
    selectedModel: null,
    selectedReasoningEffort: null,
    planMode: false,
    needsDefaultCollaborationModeReset: false,
    displayName: "Web submit fixture",
    displayNameSource: "manual",
    projectName: "project",
    projectAlias: null,
    projectPath: "/tmp/project",
    status: "idle",
    failureReason: null,
    archived: false,
    archivedAt: null,
    createdAt: "2026-04-26T00:00:00.000Z",
    lastUsedAt: "2026-04-26T00:00:00.000Z",
    lastTurnId: null,
    lastTurnStatus: null,
    ...patch
  };
}

function createHarness(sessions: SessionRow[], bindings = [{ chatId: "chat-1" }]) {
  const service = Object.create(BridgeService.prototype) as BridgeService;
  const rawService = service as any;
  const calls: unknown[] = [];
  rawService.store = {
    listChatBindings: () => bindings,
    listSessions: (chatId: string, options?: { archived?: boolean }) => {
      calls.push({ type: "listSessions", chatId, archived: options?.archived });
      return sessions.filter((session) => session.chatId === chatId && Boolean(session.archived) === Boolean(options?.archived));
    }
  };
  rawService.flushRuntimeNotices = async (chatId: string) => {
    calls.push({ type: "flush", chatId });
  };
  rawService.submitNormalTextToSession = async (chatId: string, session: SessionRow, text: string) => {
    calls.push({ type: "submit", chatId, sessionId: session.sessionId, text });
    return { status: "accepted" };
  };
  rawService.logger = { warn: async () => undefined };
  return { service, calls };
}

test("submitWebTextMessage resolves one owner binding and opaque conversation handle before delegating", async () => {
  const session = sessionFixture();
  const { service, calls } = createHarness([session]);

  const result = await service.submitWebTextMessage({
    conversationHandle: conversationHandleForSessionId(session.sessionId),
    text: "  hello from web  "
  });

  assert.deepEqual(result, { status: "accepted" });
  assert.deepEqual(calls, [
    { type: "listSessions", chatId: "chat-1", archived: false },
    { type: "listSessions", chatId: "chat-1", archived: true },
    { type: "flush", chatId: "chat-1" },
    { type: "submit", chatId: "chat-1", sessionId: "session-1", text: "hello from web" }
  ]);
});

test("submitWebTextMessage rejects raw ids, archived sessions, mismatched chat, and ambiguous owner binding", async () => {
  const active = sessionFixture();
  const archived = sessionFixture({ sessionId: "archived-session", archived: true, archivedAt: "2026-04-26T00:00:00.000Z" });

  for (const { service, handle, chatId } of [
    { ...createHarness([active]), handle: "session-1" },
    { ...createHarness([archived]), handle: conversationHandleForSessionId(archived.sessionId) },
    { ...createHarness([active], [{ chatId: "chat-1" }, { chatId: "chat-2" }]), handle: conversationHandleForSessionId(active.sessionId) },
    { ...createHarness([active]), handle: conversationHandleForSessionId(active.sessionId), chatId: "chat-2" }
  ] as Array<ReturnType<typeof createHarness> & { handle: string; chatId?: string }>) {
    const result = await service.submitWebTextMessage({
      conversationHandle: handle,
      text: "hello",
      ...(chatId ? { chatId } : {})
    });
    assert.deepEqual(result, { status: "rejected" });
  }
});
