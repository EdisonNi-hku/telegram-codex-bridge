import test from "node:test";
import assert from "node:assert/strict";

import { createWebReadonlyViewModelProvider } from "./web-readonly-view-model.js";

const fixedNow = "2026-04-26T00:00:00.000Z";

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

function assertNoForbiddenViewModelData(value: unknown): void {
  const text = serialized(value);
  for (const forbidden of [
    "/home/ubuntu/secret-workspace",
    "chatId",
    "telegramChatId",
    "messageId",
    "callback",
    "replyMarkup",
    "promptJson",
    "responseJson",
    "submit",
    "approve",
    "interrupt",
    "upload",
    "switch",
    "resume"
  ]) {
    assert.equal(text.includes(forbidden), false, `view model leaked ${forbidden}: ${text}`);
  }
}

const session = {
  sessionId: "session-1",
  chatId: "telegram-chat-123",
  telegramChatId: "telegram-chat-123",
  threadId: "thread-secret-1",
  selectedModel: "gpt-test",
  selectedReasoningEffort: "high",
  planMode: false,
  needsDefaultCollaborationModeReset: false,
  displayName: "Implement read-only Web adapter",
  displayNameSource: "manual",
  projectName: "secret-workspace",
  projectAlias: "Console Core",
  projectPath: "/home/ubuntu/secret-workspace",
  status: "running",
  failureReason: null,
  archived: false,
  archivedAt: null,
  createdAt: "2026-04-25T10:00:00.000Z",
  lastUsedAt: "2026-04-25T12:00:00.000Z",
  lastTurnId: "turn-secret-1",
  lastTurnStatus: "running"
} as const;

test("returns explicit unavailable/degraded states when injected data is absent", () => {
  const provider = createWebReadonlyViewModelProvider({ now: () => fixedNow });

  assert.deepEqual(provider.listWorkspaceViewModels().state, "unavailable");
  assert.deepEqual(provider.listWorkspaceConversationViewModels("wk_missing").state, "unavailable");
  assert.deepEqual(provider.getConversationResultViewModel("session-1").state, "unavailable");
  assert.deepEqual(provider.getConversationArtifactCatalogViewModel("session-1").state, "unavailable");
  assert.deepEqual(provider.getRuntimeContextViewModel().state, "degraded");
  assert.deepEqual(provider.getReadinessGuardrailViewModel().state, "unavailable");

  assertNoForbiddenViewModelData(provider.getHomeViewModel());
});

test("returns unavailable, degraded, and empty artifact catalog states without leaking source errors", () => {
  const unavailable = createWebReadonlyViewModelProvider({
    now: () => fixedNow
  }).getConversationArtifactCatalogViewModel("session-1");
  assert.equal(unavailable.pageId, "web_conversation_artifacts");
  assert.equal(unavailable.state, "unavailable");
  assert.deepEqual(unavailable.artifacts, []);
  assert.equal(unavailable.selectedArtifact, null);
  assert.deepEqual(unavailable.warnings, ["artifact_catalog_unavailable"]);

  const degraded = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    listArtifactDescriptors: () => {
      throw new Error("artifact read failed /tmp/secret-result https://example.invalid/raw?messageId=123");
    }
  }).getConversationArtifactCatalogViewModel("session-1");
  assert.equal(degraded.state, "degraded");
  assert.deepEqual(degraded.artifacts, []);
  assert.equal(degraded.selectedArtifact, null);
  assert.deepEqual(degraded.warnings, ["artifact_catalog_degraded"]);

  const empty = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    listArtifactDescriptors: () => []
  }).getConversationArtifactCatalogViewModel("session-1");
  assert.equal(empty.state, "empty");
  assert.deepEqual(empty.artifacts, []);
  assert.equal(empty.emptyState, "no_artifacts");
  assert.deepEqual(empty.warnings, []);

  assertNoForbiddenViewModelData({ unavailable, degraded, empty });
});

test("redacts unsafe artifact descriptors and exposes only neutral descriptor metadata", () => {
  const provider = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    listArtifactDescriptors: () => [
      {
        id: "file:/home/ubuntu/secret-workspace/result.png?token=abc",
        label: "Approve screenshot /home/ubuntu/secret-workspace/result.png callback_data=approve",
        filename: "result.png",
        kind: "image",
        type: "image/png",
        mediaType: "image/png",
        sizeBytes: 2048,
        createdAt: "2026-04-25T12:20:00.000Z",
        updatedAt: "2026-04-25T12:21:00.000Z",
        availability: "available",
        previewEligible: true,
        downloadEligible: true,
        previewUrl: "https://example.invalid/preview/result.png?messageId=123",
        downloadPath: "/tmp/secret-result/result.png",
        platformResourceId: "telegram:file:abc",
        messageId: 123,
        rawProtocol: { callback: "approve" }
      },
      {
        id: "artifact_safe_1",
        label: "Test summary",
        kind: "document",
        type: "text/markdown",
        mediaType: "text/markdown",
        sizeBytes: 512,
        createdAt: "2026-04-25T12:30:00.000Z",
        updatedAt: null,
        availability: "available",
        previewEligible: false,
        downloadEligible: false
      }
    ]
  });

  const vm = provider.getConversationArtifactCatalogViewModel("session-1");

  assert.equal(vm.state, "degraded");
  assert.equal(vm.artifacts.length, 2);
  assert.match(vm.artifacts[0]?.artifactId ?? "", /^art_[a-f0-9]{16}$/);
  assert.deepEqual(vm.artifacts[0], {
    artifactId: vm.artifacts[0]?.artifactId,
    label: "Artifact descriptor",
    kind: "image",
    type: "image/png",
    mediaType: "image/png",
    sizeBytes: 2048,
    createdAt: "2026-04-25T12:20:00.000Z",
    updatedAt: "2026-04-25T12:21:00.000Z",
    availability: "degraded",
    previewEligible: false,
    previewLabel: "Preview unavailable",
    downloadEligible: false,
    downloadLabel: "Download unavailable",
    warnings: ["artifact_descriptor_redacted"]
  });
  assert.deepEqual(vm.artifacts[1], {
    artifactId: "artifact_safe_1",
    label: "Test summary",
    kind: "document",
    type: "text/markdown",
    mediaType: "text/markdown",
    sizeBytes: 512,
    createdAt: "2026-04-25T12:30:00.000Z",
    updatedAt: null,
    availability: "available",
    previewEligible: false,
    previewLabel: "Preview unavailable",
    downloadEligible: false,
    downloadLabel: "Download unavailable",
    warnings: []
  });
  assert.deepEqual(vm.selectedArtifact, vm.artifacts[1]);
  assert.deepEqual(vm.warnings, ["artifact_descriptor_redacted"]);
  assertNoForbiddenViewModelData(vm);

  const text = serialized(vm);
  for (const forbidden of [
    "/tmp/secret-result",
    "https://example.invalid",
    "platformResourceId",
    "rawProtocol",
    "result.png",
    "token=abc",
    "telegram:file"
  ]) {
    assert.equal(text.includes(forbidden), false, `artifact view model leaked ${forbidden}: ${text}`);
  }
});

test("derives safe workspace rows from recent project and session stats without exposing raw paths", () => {
  const provider = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    store: {
      listRecentProjects: () => [
        {
          projectPath: "/home/ubuntu/secret-workspace",
          projectName: "secret-workspace",
          projectAlias: "Console Core",
          lastUsedAt: "2026-04-25T12:00:00.000Z",
          pinned: true,
          lastSessionId: "session-1",
          lastSuccessAt: "2026-04-25T11:00:00.000Z",
          source: "pin"
        }
      ],
      listSessionProjectStats: () => [
        {
          projectPath: "/home/ubuntu/secret-workspace",
          projectName: "secret-workspace",
          sessionCount: 3,
          lastUsedAt: "2026-04-25T12:00:00.000Z"
        }
      ]
    }
  });

  const vm = provider.listWorkspaceViewModels();

  assert.equal(vm.state, "available");
  assert.equal(vm.workspaces.length, 1);
  assert.equal(vm.workspaces[0]?.label, "Console Core");
  assert.equal(vm.workspaces[0]?.conversationCount, 3);
  assert.equal(vm.workspaces[0]?.pinned, true);
  assert.match(vm.workspaces[0]?.workspaceId ?? "", /^wk_[a-f0-9]{16}$/);
  assertNoForbiddenViewModelData(vm);
});

test("uses deterministic opaque labels when path-backed workspaces have no explicit alias", () => {
  const provider = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    store: {
      listRecentProjects: () => [
        {
          projectPath: "/home/ubuntu/top-secret/secret-client",
          projectName: "secret-client",
          projectAlias: null,
          lastUsedAt: "2026-04-25T12:00:00.000Z",
          pinned: false,
          source: "recent"
        }
      ],
      listSessionProjectStats: () => [
        {
          projectPath: "/home/ubuntu/top-secret/secret-client",
          projectName: "secret-client",
          sessionCount: 1,
          lastUsedAt: "2026-04-25T12:00:00.000Z"
        }
      ]
    }
  });

  const first = provider.listWorkspaceViewModels().workspaces[0];
  const second = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    store: {
      listSessionProjectStats: () => [
        {
          projectPath: "/home/ubuntu/top-secret/secret-client",
          projectName: "secret-client",
          sessionCount: 1,
          lastUsedAt: "2026-04-25T12:00:00.000Z"
        }
      ]
    }
  }).listWorkspaceViewModels().workspaces[0];

  assert.ok(first);
  assert.ok(second);
  assert.match(first.workspaceId, /^wk_[a-f0-9]{16}$/);
  assert.equal(first.workspaceId, second.workspaceId);
  assert.match(first.label, /^Workspace [a-f0-9]{8}$/);
  assert.equal(serialized(first).includes("secret-client"), false);
  assert.equal(serialized(first).includes("top-secret"), false);
  assert.equal(serialized(first).includes(Buffer.from("/home/ubuntu/top-secret/secret-client").toString("base64")), false);
  assertNoForbiddenViewModelData(first);
});

test("derives safe conversation rows for a workspace without platform ids, paths, or controls", () => {
  const provider = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    operatorBinding: { chatId: "telegram-chat-123" },
    store: {
      listRecentProjects: () => [],
      listSessionProjectStats: () => [
        {
          projectPath: "/home/ubuntu/secret-workspace",
          projectName: "secret-workspace",
          sessionCount: 1,
          lastUsedAt: "2026-04-25T12:00:00.000Z"
        }
      ],
      listSessions: () => [session]
    }
  });
  const workspace = provider.listWorkspaceViewModels().workspaces[0];
  assert.ok(workspace);

  const vm = provider.listWorkspaceConversationViewModels(workspace.workspaceId);

  assert.equal(vm.state, "available");
  assert.equal(vm.conversations.length, 1);
  assert.deepEqual(vm.conversations[0], {
    conversationId: "session-1",
    workspaceId: workspace.workspaceId,
    title: "Implement read-only Web adapter",
    status: "running",
    failureReason: null,
    archived: false,
    createdAt: "2026-04-25T10:00:00.000Z",
    lastActivityAt: "2026-04-25T12:00:00.000Z",
    lastTurnStatus: "running",
    finalAnswerAvailable: false
  });
  assertNoForbiddenViewModelData(vm);
});

test("allowlists injected final-answer body text and rejects action/control markup", () => {
  const provider = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    operatorBinding: { chatId: "telegram-chat-123" },
    store: {
      getSessionById: () => session,
      listFinalAnswerViews: () => [
        {
          answerId: "answer-safe",
          chatId: "telegram-chat-123",
          deliveryMessageId: 100,
          sessionId: "session-1",
          threadId: "thread-secret-1",
          turnId: "turn-secret-1",
          kind: "final_answer",
          deliveryState: "delivered",
          previewHtml: "<b>Telegram preview is not the neutral body</b>",
          pages: ["<b>Telegram page is not the neutral body</b>"],
          primaryActionConsumed: false,
          createdAt: "2026-04-25T12:10:00.000Z"
        },
        {
          answerId: "answer-unsafe",
          chatId: "telegram-chat-123",
          deliveryMessageId: 101,
          sessionId: "session-1",
          threadId: "thread-secret-1",
          turnId: "turn-secret-1",
          kind: "final_answer",
          deliveryState: "delivered",
          previewHtml: "<b>Unsafe</b>",
          pages: ["<b>Unsafe</b>"],
          primaryActionConsumed: false,
          createdAt: "2026-04-25T12:11:00.000Z"
        }
      ]
    },
    getSanitizedFinalAnswerBody: (answer) =>
      answer.answerId === "answer-safe"
        ? "Completed safely.\n\n- Tests passed\nUse `npm run check`."
        : '<a href="tg://callback?data=approve">Approve</a> callback messageId=123 submit interrupt upload switch resume'
  });

  const vm = provider.getConversationResultViewModel("session-1");

  assert.equal(vm.answers.length, 2);
  assert.deepEqual(vm.answers[0]?.body, {
    state: "available",
    text: "Completed safely.\n\n- Tests passed\nUse `npm run check`."
  });
  assert.deepEqual(vm.answers[1]?.body, {
    state: "unavailable",
    reason: "unsafe_final_answer_body"
  });
  assertNoForbiddenViewModelData(vm);
});

test("conversation results expose final-answer availability but not raw Telegram HTML by default", () => {
  const provider = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    operatorBinding: { chatId: "telegram-chat-123" },
    store: {
      getSessionById: () => session,
      listFinalAnswerViews: () => [
        {
          answerId: "answer-1",
          chatId: "telegram-chat-123",
          deliveryMessageId: 999,
          sessionId: "session-1",
          threadId: "thread-secret-1",
          turnId: "turn-secret-1",
          kind: "final_answer",
          deliveryState: "delivered",
          previewHtml: "<b>Done</b> /home/ubuntu/secret-workspace",
          pages: ["<i>Unsafe Telegram HTML</i> /home/ubuntu/secret-workspace"],
          primaryActionConsumed: false,
          createdAt: "2026-04-25T12:10:00.000Z"
        }
      ]
    }
  });

  const vm = provider.getConversationResultViewModel("session-1");

  assert.equal(vm.state, "available");
  assert.equal(vm.answers.length, 1);
  assert.deepEqual(vm.answers[0], {
    answerId: "answer-1",
    kind: "final_answer",
    deliveryState: "delivered",
    createdAt: "2026-04-25T12:10:00.000Z",
    body: { state: "unavailable", reason: "sanitized_body_not_provided" },
    summary: "Final answer is available, but body is hidden until a Web-safe sanitized body is provided."
  });
  assertNoForbiddenViewModelData(vm);
});

test("sanitizes runtime and readiness view models with strict allowlists", () => {
  const provider = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    listActiveTurns: () => [
      {
        sessionId: "session-1",
        status: "running",
        summary: "Running tests; raw output omitted",
        blockedReason: "awaiting_approval",
        messageId: 123,
        replyMarkup: { inline_keyboard: [[{ text: "Approve", callback_data: "callback-secret" }]] },
        rawTerminal: "cat /home/ubuntu/secret-workspace/.env"
      }
    ],
    getReadinessSnapshot: () => ({
      state: "degraded",
      checkedAt: "2026-04-25T12:30:00.000Z",
      appServerPid: "4242",
      details: {
        activePack: "telegram",
        codexInstalled: true,
        codexAuthenticated: true,
        appServerAvailable: false,
        authorizedUserBound: true,
        codexBinResolvedPath: "/home/ubuntu/.local/bin/codex",
        issues: ["App server unavailable at /home/ubuntu/socket"]
      }
    })
  });

  const runtime = provider.getRuntimeContextViewModel();
  assert.equal(runtime.state, "available");
  assert.deepEqual(runtime.activeTurns[0], {
    sessionId: "session-1",
    status: "running",
    summary: "Running tests; raw output omitted",
    blockedReason: "awaiting_approval"
  });

  const readiness = provider.getReadinessGuardrailViewModel();
  assert.equal(readiness.state, "degraded");
  assert.equal(readiness.capabilities.some((row) => row.label === "App server" && row.observed === "missing"), true);
  assert.equal(readiness.missingGates.includes("App server unavailable"), true);

  assertNoForbiddenViewModelData({ runtime, readiness });
});

test("returns unavailable pending-interactions view model when the read facade is absent or throws", () => {
  const unavailable = createWebReadonlyViewModelProvider({ now: () => fixedNow }).getPendingInteractionsViewModel();
  assert.equal(unavailable.pageId, "web_pending_interactions");
  assert.equal(unavailable.state, "unavailable");
  assert.deepEqual(unavailable.pendingInteractions, []);
  assert.deepEqual(unavailable.warnings, ["pending_interactions_unavailable"]);

  const thrown = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    listPendingInteractions: () => {
      throw new Error("raw pending interaction store failed /home/ubuntu/secret-workspace");
    }
  }).getPendingInteractionsViewModel();
  assert.equal(thrown.state, "unavailable");
  assert.deepEqual(thrown.pendingInteractions, []);
  assert.deepEqual(thrown.warnings, ["pending_interactions_unavailable"]);
  assertNoForbiddenViewModelData({ unavailable, thrown });
});

test("normalizes and redacts pending interactions without exposing platform payloads or controls", () => {
  const provider = createWebReadonlyViewModelProvider({
    now: () => fixedNow,
    listPendingInteractions: () => [
      {
        id: "telegram:chat-123:message-999:/home/ubuntu/secret-workspace",
        sessionId: "session-1",
        conversationId: "session-1",
        status: "awaiting_callback_submit",
        kind: "codex_approval",
        createdAt: "2026-04-25T12:00:00.000Z",
        updatedAt: "2026-04-25T12:01:00.000Z",
        summary: "Approve via callback_data=approve messageId=777 /home/ubuntu/secret-workspace",
        blockingReason: "Waiting for callback payload from telegramChatId=telegram-chat-123",
        promptJson: { text: "raw prompt should stay hidden" },
        responseJson: { ok: true },
        replyMarkup: { inline_keyboard: [[{ text: "Approve", callback_data: "approve:secret" }]] },
        platformMessageId: 999,
        chatId: "telegram-chat-123"
      },
      {
        id: "pending_safe_1",
        sessionId: "session-2",
        status: "awaiting_user_input",
        kind: "question",
        createdAt: "2026-04-25T13:00:00.000Z",
        updatedAt: null,
        summary: "Waiting for a short answer from the operator.",
        blockingReason: "Conversation is waiting for operator input."
      }
    ]
  });

  const vm = provider.getPendingInteractionsViewModel();

  assert.equal(vm.pageId, "web_pending_interactions");
  assert.equal(vm.state, "degraded");
  assert.equal(vm.pendingInteractions.length, 2);
  assert.match(vm.pendingInteractions[0]?.interactionId ?? "", /^pi_[a-f0-9]{16}$/);
  assert.deepEqual(vm.pendingInteractions[0], {
    interactionId: vm.pendingInteractions[0]?.interactionId,
    conversationId: "session-1",
    sessionId: "session-1",
    status: "pending",
    kind: "interaction",
    createdAt: "2026-04-25T12:00:00.000Z",
    updatedAt: "2026-04-25T12:01:00.000Z",
    blockingReason: "Awaiting user input; details hidden for this read-only surface.",
    summary: { state: "unavailable", reason: "unsafe_pending_interaction_summary" },
    availability: "degraded",
    warnings: ["pending_interaction_details_redacted"]
  });
  assert.deepEqual(vm.pendingInteractions[1], {
    interactionId: "pending_safe_1",
    conversationId: "session-2",
    sessionId: "session-2",
    status: "awaiting_user_input",
    kind: "question",
    createdAt: "2026-04-25T13:00:00.000Z",
    updatedAt: null,
    blockingReason: "Conversation is waiting for operator input.",
    summary: { state: "available", text: "Waiting for a short answer from the operator." },
    availability: "available",
    warnings: []
  });
  assert.deepEqual(vm.warnings, ["pending_interaction_details_redacted"]);
  assertNoForbiddenViewModelData(vm);
});
