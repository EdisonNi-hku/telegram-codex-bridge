import test from "node:test";
import assert from "node:assert/strict";

import { createWebReadonlyLiveProvider } from "./web-readonly-live-provider.js";

const fixedNow = "2026-04-26T00:00:00.000Z";

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

function assertNoForbiddenLiveData(value: unknown): void {
  const text = serialized(value);
  for (const forbidden of [
    "/home/ubuntu/secret-workspace",
    "/tmp/secret-store",
    "chat-secret",
    "chat-other",
    "telegramChatId",
    "feishuChatId",
    "deliveryMessageId",
    "messageId",
    "thread-secret",
    "callback",
    "replyMarkup",
    "localPath",
    "resourceId",
    "rawJson",
    "submit",
    "approve",
    "interrupt",
    "upload",
    "switch",
    "resume"
  ]) {
    assert.equal(text.includes(forbidden), false, `live view model leaked ${forbidden}: ${text}`);
  }
}

const safeSession = {
  sessionId: "session-1",
  chatId: "chat-secret",
  telegramChatId: "telegram-chat-secret",
  threadId: "thread-secret",
  displayName: "Readonly seam",
  projectName: "secret-workspace",
  projectAlias: "Console Core",
  projectPath: "/home/ubuntu/secret-workspace",
  status: "idle",
  failureReason: null,
  archived: false,
  createdAt: "2026-04-25T10:00:00.000Z",
  lastUsedAt: "2026-04-25T12:00:00.000Z",
  lastTurnId: "turn-secret",
  lastTurnStatus: "completed"
} as const;

test("no binding returns unavailable/degraded public view models without leaking store data", () => {
  const provider = createWebReadonlyLiveProvider({
    now: () => fixedNow,
    auth: { listOperatorBindings: () => [] },
    store: {
      listRecentProjects: () => [
        {
          projectPath: "/home/ubuntu/secret-workspace",
          projectName: "secret-workspace",
          projectAlias: "Secret Alias",
          lastUsedAt: "2026-04-25T12:00:00.000Z"
        }
      ],
      listSessions: () => [safeSession],
      listFinalAnswerViews: () => [
        {
          answerId: "answer-1",
          chatId: "chat-secret",
          deliveryMessageId: 777,
          sessionId: "session-1",
          threadId: "thread-secret",
          turnId: "turn-secret",
          kind: "final_answer",
          deliveryState: "delivered",
          createdAt: "2026-04-25T12:30:00.000Z"
        }
      ]
    }
  });

  assert.equal(provider.listWorkspaceViewModels().state, "unavailable");
  assert.equal(provider.listWorkspaceConversationViewModels("wk_missing").state, "unavailable");
  assert.equal(provider.getConversationResultViewModel("session-1").state, "unavailable");
  assert.equal(provider.getPendingInteractionsViewModel().state, "unavailable");
  assert.equal(provider.getRuntimeContextViewModel().state, "degraded");
  assert.equal(provider.getHomeViewModel().operator.binding, "unavailable");
  assertNoForbiddenLiveData({
    home: provider.getHomeViewModel(),
    workspaces: provider.listWorkspaceViewModels(),
    conversations: provider.listWorkspaceConversationViewModels("wk_missing"),
    result: provider.getConversationResultViewModel("session-1")
  });
});

test("one binding scopes sessions and final-answer metadata internally without exposing platform ids", () => {
  const calls: string[] = [];
  const provider = createWebReadonlyLiveProvider({
    now: () => fixedNow,
    auth: {
      listOperatorBindings: () => [{ chatId: "chat-secret", platform: "telegram", userId: "telegram-user-secret" }]
    },
    store: {
      listSessionProjectStats: () => [
        {
          projectPath: "/home/ubuntu/secret-workspace",
          projectName: "secret-workspace",
          sessionCount: 1,
          lastUsedAt: "2026-04-25T12:00:00.000Z"
        }
      ],
      listSessions: (chatId) => {
        calls.push(`sessions:${chatId}`);
        return [safeSession];
      },
      getSessionById: (_sessionId) => {
        calls.push("session:raw");
        throw new Error("detail lookup must not use raw session id");
      },
      listFinalAnswerViews: (chatId) => {
        calls.push(`answers:${chatId}`);
        return [
          {
            answerId: "answer-1",
            chatId: "chat-secret",
            deliveryMessageId: 777,
            sessionId: "session-1",
            threadId: "thread-secret",
            turnId: "turn-secret",
            kind: "final_answer",
            deliveryState: "delivered",
            previewHtml: "<b>Telegram body should stay hidden</b>",
            pages: ["/home/ubuntu/secret-workspace raw page"],
            createdAt: "2026-04-25T12:30:00.000Z"
          }
        ];
      },
      listPendingInteractions: (chatId) => {
        calls.push(`pending:${chatId}`);
        return [
          {
            id: "pending_safe_1",
            sessionId: "session-1",
            status: "awaiting_user_input",
            kind: "question",
            createdAt: "2026-04-25T12:40:00.000Z",
            summary: "Waiting for a short answer."
          }
        ];
      }
    }
  });

  const workspace = provider.listWorkspaceViewModels().workspaces[0];
  assert.ok(workspace);
  const conversations = provider.listWorkspaceConversationViewModels(workspace.workspaceId);
  const conversationHandle = conversations.conversations[0]?.conversationHandle ?? "";
  const result = provider.getConversationResultViewModel(conversationHandle);
  const rawResult = provider.getConversationResultViewModel("session-1");
  const pending = provider.getPendingInteractionsViewModel();

  assert.equal(conversations.state, "available");
  assert.match(conversations.conversations[0]?.conversationId ?? "", /^cv_[a-f0-9]{16}$/);
  assert.equal(conversations.conversations[0]?.conversationId, conversationHandle);
  assert.equal(conversations.conversations[0]?.finalAnswerAvailable, true);
  assert.equal(result.state, "available");
  assert.equal(rawResult.state, "unavailable");
  assert.equal(result.answers[0]?.answerId, "answer-1");
  assert.deepEqual(result.answers[0]?.body, { state: "unavailable", reason: "sanitized_body_not_provided" });
  assert.equal(pending.state, "available");
  assert.deepEqual(calls.filter((call) => call.includes("chat-secret")).sort(), [
    "answers:chat-secret",
    "answers:chat-secret",
    "pending:chat-secret",
    "pending:chat-secret",
    "sessions:chat-secret",
    "sessions:chat-secret",
    "sessions:chat-secret",
    "sessions:chat-secret"
  ]);
  assertNoForbiddenLiveData({ workspace, conversations, result, pending });
});

test("unscoped recent project and stat readers cannot populate live Web workspace rows", () => {
  const provider = createWebReadonlyLiveProvider({
    now: () => fixedNow,
    auth: { listOperatorBindings: () => [{ chatId: "chat-secret" }] },
    store: {
      listRecentProjects: () => [
        {
          projectPath: "/home/ubuntu/global-workspace",
          projectName: "global-workspace",
          projectAlias: "Global Leak",
          lastUsedAt: "2026-04-25T14:00:00.000Z",
          pinned: true
        }
      ],
      listSessionProjectStats: () => [
        {
          projectPath: "/home/ubuntu/global-workspace",
          projectName: "global-workspace",
          sessionCount: 99,
          lastUsedAt: "2026-04-25T14:00:00.000Z"
        }
      ],
      listSessions: (chatId) => chatId === "chat-secret" ? [safeSession] : []
    }
  });

  const vm = provider.listWorkspaceViewModels();

  assert.equal(vm.state, "available");
  assert.equal(vm.workspaces.length, 1);
  assert.equal(vm.workspaces[0]?.label, "Console Core");
  assert.equal(vm.workspaces[0]?.conversationCount, 1);
  assert.equal(vm.workspaces[0]?.pinned, false);
  const text = serialized(vm);
  for (const forbidden of ["/home/ubuntu/global-workspace", "Global Leak", "global-workspace", "99"]) {
    assert.equal(text.includes(forbidden), false, `live view model leaked ${forbidden}: ${text}`);
  }
  assertNoForbiddenLiveData(vm);
});

test("conversation detail resolves only through the single binding's opaque handle", () => {
  const otherSession = {
    ...safeSession,
    sessionId: "session-other",
    chatId: "chat-other",
    telegramChatId: "telegram-chat-other",
    displayName: "Other operator conversation",
    lastTurnId: "turn-other"
  };
  const store = {
    listSessions: () => [safeSession, otherSession],
    listFinalAnswerViews: () => []
  };
  const secretProvider = createWebReadonlyLiveProvider({
    now: () => fixedNow,
    auth: { listOperatorBindings: () => [{ chatId: "chat-secret" }] },
    store
  });
  const otherProvider = createWebReadonlyLiveProvider({
    now: () => fixedNow,
    auth: { listOperatorBindings: () => [{ chatId: "chat-other" }] },
    store
  });

  const secretWorkspace = secretProvider.listWorkspaceViewModels().workspaces[0];
  assert.ok(secretWorkspace);
  const secretHandle = secretProvider.listWorkspaceConversationViewModels(secretWorkspace.workspaceId).conversations[0]?.conversationHandle ?? "";
  const otherWorkspace = otherProvider.listWorkspaceViewModels().workspaces[0];
  assert.ok(otherWorkspace);
  const otherHandle = otherProvider.listWorkspaceConversationViewModels(otherWorkspace.workspaceId).conversations[0]?.conversationHandle ?? "";

  assert.match(secretHandle, /^cv_[a-f0-9]{16}$/);
  assert.match(otherHandle, /^cv_[a-f0-9]{16}$/);
  assert.notEqual(secretHandle, otherHandle);
  assert.equal(secretProvider.getConversationResultViewModel(secretHandle).state, "available");
  assert.equal(secretProvider.getConversationResultViewModel(otherHandle).state, "unavailable");
  assert.equal(secretProvider.getConversationResultViewModel("session-1").state, "unavailable");
  assertNoForbiddenLiveData({
    secret: secretProvider.getConversationResultViewModel(secretHandle),
    otherAttempt: secretProvider.getConversationResultViewModel(otherHandle)
  });
});

test("multiple bindings return safe unavailable/degraded behavior instead of guessing", () => {
  const provider = createWebReadonlyLiveProvider({
    now: () => fixedNow,
    auth: {
      listOperatorBindings: () => [
        { chatId: "chat-secret", platform: "telegram" },
        { chatId: "chat-other", platform: "feishu" }
      ]
    },
    store: {
      listSessionProjectStats: () => [
        {
          projectPath: "/home/ubuntu/secret-workspace",
          projectName: "secret-workspace",
          sessionCount: 1,
          lastUsedAt: "2026-04-25T12:00:00.000Z"
        }
      ],
      listSessions: () => [safeSession]
    }
  });

  assert.equal(provider.getHomeViewModel().operator.binding, "unavailable");
  assert.equal(provider.listWorkspaceViewModels().state, "unavailable");
  assert.equal(provider.listWorkspaceConversationViewModels("wk_any").state, "unavailable");
  assertNoForbiddenLiveData({ home: provider.getHomeViewModel(), workspaces: provider.listWorkspaceViewModels() });
});

test("store throws surface generic warnings only", () => {
  const provider = createWebReadonlyLiveProvider({
    now: () => fixedNow,
    auth: { listOperatorBindings: () => [{ chatId: "chat-secret" }] },
    store: {
      listRecentProjects: () => {
        throw new Error("database failed for chat-secret at /tmp/secret-store with messageId=999");
      },
      listSessionProjectStats: () => {
        throw new Error("stats failed at /home/ubuntu/secret-workspace");
      },
      listSessions: () => {
        throw new Error("sessions failed for chat-secret /home/ubuntu/secret-workspace");
      },
      getSessionById: () => {
        throw new Error("session failed for chat-secret /home/ubuntu/secret-workspace");
      },
      listFinalAnswerViews: () => {
        throw new Error("answer failed thread-secret messageId=999");
      },
      listPendingInteractions: () => {
        throw new Error("pending failed callback approve /tmp/secret-store");
      }
    }
  });

  const workspaces = provider.listWorkspaceViewModels();
  const result = provider.getConversationResultViewModel("session-1");
  const pending = provider.getPendingInteractionsViewModel();

  assert.equal(workspaces.state, "degraded");
  assert.deepEqual(workspaces.warnings, ["sessions_unavailable"]);
  assert.equal(result.state, "unavailable");
  assert.deepEqual(result.warnings, ["conversation_data_unavailable"]);
  assert.equal(pending.state, "unavailable");
  assert.deepEqual(pending.warnings, ["pending_interactions_unavailable"]);
  assertNoForbiddenLiveData({ workspaces, result, pending });
});

test("readiness snapshots with path-like issue details are sanitized by the produced view model", () => {
  const provider = createWebReadonlyLiveProvider({
    now: () => fixedNow,
    auth: { listOperatorBindings: () => [{ chatId: "chat-secret" }] },
    readiness: {
      getReadinessSnapshot: () => ({
        state: "degraded",
        checkedAt: "2026-04-25T13:00:00.000Z",
        appServerPid: "4242",
        details: {
          activePack: "telegram",
          codexInstalled: false,
          codexAuthenticated: true,
          appServerAvailable: false,
          authorizedUserBound: true,
          issues: ["Codex binary missing at /home/ubuntu/secret-workspace/bin/codex", "Socket unavailable at /tmp/secret-store/app.sock"]
        }
      })
    }
  });

  const readiness = provider.getReadinessGuardrailViewModel();

  assert.equal(readiness.state, "degraded");
  assert.deepEqual(readiness.missingGates, ["Codex binary missing", "Socket unavailable"]);
  assert.equal(readiness.capabilities.some((row) => row.key === "codex_installed" && row.observed === "missing"), true);
  assertNoForbiddenLiveData(readiness);
});
