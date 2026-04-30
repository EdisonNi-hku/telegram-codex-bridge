import test from "node:test";
import assert from "node:assert/strict";

import type { AddressInfo } from "node:net";

import { createReadonlyAccessGate } from "./readonly-access.js";
import { createReadonlyHttpServer } from "./readonly-http-server.js";
import { createConsoleBridgeReadAdapter, type ConsoleBridgeReadAdapter } from "./console-bridge-read-adapter.js";
import { isConsoleOpaqueId, type ConsoleApiError, type ConsoleOpaqueIdKind } from "./console-api-contract.js";
import type {
  WebReadonlyConversationResultViewModel,
  WebReadonlyViewModelProvider
} from "../service/web-readonly-view-model.js";

const token = "local-test-token";
const fixedNow = "2026-05-01T00:00:00.000Z";

function makeProvider(calls: string[] = []): WebReadonlyViewModelProvider {
  return {
    getHomeViewModel() {
      calls.push("home");
      throw new Error("home should not be used by API tests");
    },
    listWorkspaceViewModels() {
      calls.push("workspaces");
      return {
        generatedAt: fixedNow,
        prototypeOnly: true,
        readonly: true,
        pageId: "web_workspaces",
        state: "available",
        workspaces: [
          {
            workspaceId: "wk_aaaabbbbccccdddd",
            label: "Console Core",
            availability: "available",
            conversationCount: 1,
            pinned: true,
            lastActivityAt: "2026-04-30T12:00:00.000Z",
            lastSuccessAt: null,
            source: "sessions"
          }
        ],
        warnings: []
      };
    },
    listWorkspaceConversationViewModels(workspaceId: string) {
      calls.push(`workspace:${workspaceId}`);
      return {
        generatedAt: fixedNow,
        prototypeOnly: true,
        readonly: true,
        pageId: "web_workspace_conversations",
        state: "available",
        workspaceId,
        conversations: [
          {
            conversationId: "cv_1111222233334444",
            conversationHandle: "cv_1111222233334444",
            workspaceId,
            title: "Implement API wiring",
            status: "running",
            failureReason: null,
            archived: false,
            createdAt: "2026-04-30T11:00:00.000Z",
            lastActivityAt: "2026-04-30T12:01:00.000Z",
            lastTurnStatus: "running",
            finalAnswerAvailable: true
          }
        ],
        emptyState: null,
        warnings: []
      };
    },
    getConversationResultViewModel(conversationHandle: string) {
      calls.push(`conversation:${conversationHandle}`);
      return conversationDetail(conversationHandle);
    },
    getConversationArtifactCatalogViewModel(sessionId: string) {
      calls.push(`artifacts:${sessionId}`);
      return {
        generatedAt: fixedNow,
        prototypeOnly: true,
        readonly: true,
        pageId: "web_conversation_artifacts",
        state: "available",
        conversationId: sessionId,
        artifacts: [
          {
            artifactId: "art_descriptor_1",
            label: "Run summary",
            kind: "document",
            type: "text/markdown",
            mediaType: "text/markdown",
            sizeBytes: 512,
            createdAt: "2026-04-30T12:03:00.000Z",
            updatedAt: null,
            availability: "available",
            previewEligible: false,
            previewLabel: "Preview unavailable",
            downloadEligible: false,
            downloadLabel: "Download unavailable",
            warnings: []
          }
        ],
        selectedArtifact: null,
        emptyState: null,
        warnings: []
      };
    },
    getRuntimeContextViewModel() {
      calls.push("runtime");
      return {
        generatedAt: fixedNow,
        prototypeOnly: true,
        readonly: true,
        pageId: "web_runtime_context",
        state: "available",
        activeTurns: [
          {
            sessionId: "cv_1111222233334444",
            status: "running",
            summary: "Mapping read-only HTTP endpoints.",
            blockedReason: null
          }
        ],
        warnings: []
      };
    },
    getPendingInteractionsViewModel() {
      calls.push("interactions");
      return {
        generatedAt: fixedNow,
        prototypeOnly: true,
        readonly: true,
        pageId: "web_pending_interactions",
        state: "available",
        pendingInteractions: [
          {
            interactionId: "pi_safe_1",
            conversationId: "cv_1111222233334444",
            sessionId: null,
            status: "pending_approval",
            kind: "command",
            createdAt: "2026-04-30T12:02:00.000Z",
            updatedAt: null,
            blockingReason: "Codex wants permission to run tests.",
            summary: { state: "available", text: "Run targeted web tests." },
            availability: "available",
            warnings: []
          }
        ],
        warnings: []
      };
    },
    getReadinessGuardrailViewModel() {
      calls.push("readiness");
      return {
        generatedAt: fixedNow,
        prototypeOnly: true,
        readonly: true,
        pageId: "web_readiness_guardrails",
        state: "ready",
        checkedAt: fixedNow,
        activePack: null,
        capabilities: [],
        missingGates: [],
        warnings: []
      };
    }
  };
}

function conversationDetail(conversationHandle: string): WebReadonlyConversationResultViewModel {
  return {
    generatedAt: fixedNow,
    prototypeOnly: true,
    readonly: true,
    pageId: "web_conversation_result",
    state: "available",
    conversation: {
      conversationId: conversationHandle,
      conversationHandle,
      workspaceId: "wk_aaaabbbbccccdddd",
      title: "Implement API wiring",
      workspaceLabel: "Console Core",
      status: "running",
      failureReason: null,
      archived: false,
      createdAt: "2026-04-30T11:00:00.000Z",
      lastActivityAt: "2026-04-30T12:01:00.000Z"
    },
    answers: [
      {
        answerId: "answer-safe-1",
        kind: "final_answer",
        deliveryState: "delivered",
        createdAt: "2026-04-30T12:03:00.000Z",
        body: { state: "available", text: "Read-only API wiring is available." },
        summary: "Final answer body was provided by an injected Web-safe sanitizer."
      }
    ],
    runtime: {
      state: "available",
      activeTurns: [
        {
          sessionId: conversationHandle,
          status: "running",
          summary: "Mapping read-only HTTP endpoints.",
          blockedReason: null
        }
      ]
    },
    pendingInteractions: {
      state: "available",
      pendingInteractions: [
        {
          interactionId: "pi_safe_1",
          conversationId: conversationHandle,
          sessionId: null,
          status: "pending_approval",
          kind: "command",
          createdAt: "2026-04-30T12:02:00.000Z",
          updatedAt: null,
          blockingReason: "Codex wants permission to run tests.",
          summary: { state: "available", text: "Run targeted web tests." },
          availability: "available",
          warnings: []
        }
      ]
    },
    readiness: { state: "ready", missingGates: [] },
    composer: {
      state: "disabled",
      label: "Message Codex",
      placeholder: "Type a message to Codex",
      disabledReason: "Sending from Web is landing next.",
      capability: "web_send_landing_next"
    },
    warnings: []
  };
}

async function withServer<T>(
  options: Parameters<typeof createReadonlyHttpServer>[0],
  run: (baseUrl: string) => Promise<T>
): Promise<T> {
  const server = createReadonlyHttpServer(options);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function request(
  url: string,
  options: { bearer?: string; method?: string } = {}
): Promise<{ status: number; text: string; headers: Headers }> {
  const init: RequestInit = {
    method: options.method ?? "GET",
    redirect: "manual"
  };
  if (options.bearer) {
    init.headers = { Authorization: `Bearer ${options.bearer}` };
  }
  const response = await fetch(url, {
    ...init
  });
  return { status: response.status, text: await response.text(), headers: response.headers };
}

test("unauthenticated API request returns generic JSON denial and does not invoke provider or adapter", async () => {
  const providerCalls: string[] = [];
  const adapterCalls: string[] = [];
  const adapter: ConsoleBridgeReadAdapter = {
    getBootstrap() {
      adapterCalls.push("bootstrap");
      throw new Error("should not be invoked");
    },
    listProjects() {
      adapterCalls.push("projects");
      return [];
    },
    listProjectSessions() {
      adapterCalls.push("sessions");
      return [];
    },
    getSessionDetail() {
      adapterCalls.push("detail");
      return { code: "not_found", message: "Not found.", retryable: false };
    }
  };

  await withServer({
    provider: makeProvider(providerCalls),
    access: createReadonlyAccessGate({ enabled: true, token }),
    consoleReadAdapter: adapter
  }, async (baseUrl) => {
    const result = await request(`${baseUrl}/api/console/bootstrap`);

    assert.equal(result.status, 404);
    assert.match(result.headers.get("content-type") ?? "", /^application\/json; charset=utf-8/);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.deepEqual(JSON.parse(result.text), { code: "not_found", message: "Not found.", retryable: false });
    assert.deepEqual(providerCalls, []);
    assert.deepEqual(adapterCalls, []);
  });
});

test("authenticated bootstrap JSON returns safe contract data and JSON no-store headers", async () => {
  const providerCalls: string[] = [];
  await withServer({
    provider: makeProvider(providerCalls),
    access: createReadonlyAccessGate({ enabled: true, token }),
    consoleReadAdapter: createConsoleBridgeReadAdapter({ provider: makeProvider(providerCalls), now: () => fixedNow, idSalt: "api-test" })
  }, async (baseUrl) => {
    const result = await request(`${baseUrl}/api/console/bootstrap`, { bearer: token });
    const body = JSON.parse(result.text);

    assert.equal(result.status, 200);
    assert.match(result.headers.get("content-type") ?? "", /^application\/json; charset=utf-8/);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal(result.headers.get("x-content-type-options"), "nosniff");
    assert.equal(body.apiVersion, "2026-05-01.phase3");
    assert.equal(body.viewer.role, "owner");
    assert.equal(body.capabilities.sendMessage.state, "disabled");
    assert.equal(isConsoleOpaqueId("project", body.activeProjectId), true);
    assert.equal(isConsoleOpaqueId("session", body.activeSessionId), true);
    assertNoForbiddenConsoleData(body);
    assertConsoleIds(body);
  });
});

test("authenticated projects JSON returns opaque project IDs", async () => {
  await withServer({
    provider: makeProvider(),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await request(`${baseUrl}/api/projects`, { bearer: token });
    const projects = JSON.parse(result.text);

    assert.equal(result.status, 200);
    assert.equal(projects.length, 1);
    assert.equal(isConsoleOpaqueId("project", projects[0].projectId), true);
    assert.equal(isConsoleOpaqueId("session", projects[0].activeSessionId), true);
    assert.notEqual(projects[0].projectId, "wk_aaaabbbbccccdddd");
    assertNoForbiddenConsoleData(projects);
    assertConsoleIds(projects);
  });
});

test("authenticated project sessions JSON rejects invalid/raw IDs and returns sessions for a valid ID", async () => {
  await withServer({
    provider: makeProvider(),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    for (const rawId of ["wk_aaaabbbbccccdddd", "project-1", "%2Ftmp%2Fsecret", "prj_callback_data_123"]) {
      const result = await request(`${baseUrl}/api/projects/${rawId}/sessions`, { bearer: token });
      assert.equal(result.status, 400, rawId);
      assert.equal(result.text.includes(rawId), false);
      assertNoForbiddenConsoleData(JSON.parse(result.text));
    }

    const projects = JSON.parse((await request(`${baseUrl}/api/projects`, { bearer: token })).text);
    const validProjectId = projects[0].projectId;
    const sessionsResult = await request(`${baseUrl}/api/projects/${validProjectId}/sessions`, { bearer: token });
    const sessions = JSON.parse(sessionsResult.text);

    assert.equal(sessionsResult.status, 200);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].projectId, validProjectId);
    assert.equal(isConsoleOpaqueId("session", sessions[0].sessionId), true);
    assertNoForbiddenConsoleData(sessions);
    assertConsoleIds(sessions);
  });
});

test("authenticated session detail JSON returns safe data or safe ConsoleApiError", async () => {
  await withServer({
    provider: makeProvider(),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const projects = JSON.parse((await request(`${baseUrl}/api/projects`, { bearer: token })).text);
    const sessions = JSON.parse((await request(`${baseUrl}/api/projects/${projects[0].projectId}/sessions`, { bearer: token })).text);
    const validSessionId = sessions[0].sessionId;

    const detailResult = await request(`${baseUrl}/api/sessions/${validSessionId}`, { bearer: token });
    const detail = JSON.parse(detailResult.text);
    assert.equal(detailResult.status, 200);
    assert.equal(detail.sessionId, validSessionId);
    assert.ok(detail.messages.some((message: { role: string }) => message.role === "assistant"));
    assert.equal(detail.eventsUrl, `/api/sessions/${validSessionId}/events`);
    assertNoForbiddenConsoleData(detail);
    assertConsoleIds(detail);

    const invalid = await request(`${baseUrl}/api/sessions/cv_1111222233334444`, { bearer: token });
    const error = JSON.parse(invalid.text) as ConsoleApiError;
    assert.equal(invalid.status, 400);
    assert.equal(error.code, "bad_request");
    assertNoForbiddenConsoleData(error);
  });
});

test("optional session events endpoint is a safe JSON placeholder", async () => {
  await withServer({
    provider: makeProvider(),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const projects = JSON.parse((await request(`${baseUrl}/api/projects`, { bearer: token })).text);
    const sessions = JSON.parse((await request(`${baseUrl}/api/projects/${projects[0].projectId}/sessions`, { bearer: token })).text);

    const result = await request(`${baseUrl}/api/sessions/${sessions[0].sessionId}/events`, { bearer: token });
    const body = JSON.parse(result.text) as ConsoleApiError;

    assert.equal(result.status, 409);
    assert.equal(body.code, "capability_disabled");
    assert.equal(body.capability, "streamEvents");
    assertNoForbiddenConsoleData(body);
  });
});

test("unsupported POST API routes remain denied/not found and do not invoke read source", async () => {
  const calls: string[] = [];
  await withServer({
    provider: makeProvider(calls),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await request(`${baseUrl}/api/projects`, { bearer: token, method: "POST" });

    assert.equal(result.status, 404);
    assert.deepEqual(JSON.parse(result.text), { code: "not_found", message: "Not found.", retryable: false });
    assert.deepEqual(calls, []);
  });
});

test("no raw platform, path, token, or bridge identifiers leak from an injected dirty adapter", async () => {
  const dirtyAdapter: ConsoleBridgeReadAdapter = {
    getBootstrap() {
      return {
        apiVersion: "2026-05-01.phase3",
        generatedAt: fixedNow,
        viewer: { role: "owner", displayName: "Telegram /home/ubuntu/secret token=abc callback_data=raw" },
        capabilities: {
          archiveProject: { state: "disabled", reason: "token=abc" },
          createSession: { state: "disabled" },
          sendMessage: { state: "disabled" },
          answerApproval: { state: "disabled" },
          uploadFiles: { state: "disabled" },
          streamEvents: { state: "enabled" },
          fetchArtifacts: { state: "enabled" }
        },
        projects: [
          {
            projectId: "wk_aaaabbbbccccdddd",
            title: "/tmp/raw token=abc telegramChatId=123",
            archived: false,
            sessionCount: 1,
            activeSessionId: "cv_1111222233334444"
          }
        ],
        commands: [],
        models: [],
        modes: [],
        degradedStates: []
      } as never;
    },
    listProjects() {
      return [
        {
          projectId: "wk_aaaabbbbccccdddd",
          title: "feishu open_id=ou_secret /tmp/project token=abc",
          archived: false,
          sessionCount: 1
        }
      ] as never;
    },
    listProjectSessions() {
      return [];
    },
    getSessionDetail() {
      return { code: "not_found", message: "Not found.", retryable: false };
    }
  };

  await withServer({
    provider: makeProvider(),
    access: createReadonlyAccessGate({ enabled: true, token }),
    consoleReadAdapter: dirtyAdapter
  }, async (baseUrl) => {
    for (const path of ["/api/console/bootstrap", "/api/projects"]) {
      const result = await request(`${baseUrl}${path}`, { bearer: token });
      const body = JSON.parse(result.text);

      assert.equal(result.status, 500, `${path}: ${result.text}`);
      assert.deepEqual(body, {
        code: "internal_error",
        message: "Console API response is temporarily unavailable.",
        retryable: true
      });
      for (const forbidden of ["/home/ubuntu", "/tmp/", "telegram", "Telegram", "feishu", "open_id", "callback_data", "token=", "telegramChatId", "cv_1111222233334444", "wk_aaaabbbbccccdddd"]) {
        assert.equal(result.text.includes(forbidden), false, `${path} leaked ${forbidden}: ${result.text}`);
      }
    }
  });
});

const idFieldKinds = {
  projectId: "project",
  activeProjectId: "project",
  sessionId: "session",
  activeSessionId: "session",
  messageId: "message",
  runId: "run",
  activeRunId: "run",
  approvalId: "approval",
  artifactId: "artifact"
} as const satisfies Record<string, ConsoleOpaqueIdKind>;

const listIdFieldKinds = {
  approvalIds: "approval",
  artifactIds: "artifact"
} as const satisfies Record<string, ConsoleOpaqueIdKind>;

function assertConsoleIds(value: unknown): void {
  visitShape(value, (node, key) => {
    if (!key) {
      return;
    }
    const kind = idFieldKinds[key as keyof typeof idFieldKinds];
    if (kind) {
      assert.equal(isConsoleOpaqueId(kind, node), true, `${key} must be opaque`);
    }
    const listKind = listIdFieldKinds[key as keyof typeof listIdFieldKinds];
    if (listKind) {
      assert.ok(Array.isArray(node), `${key} must be an array`);
      for (const item of node) {
        assert.equal(isConsoleOpaqueId(listKind, item), true, `${key} item must be opaque`);
      }
    }
  });
}

function assertNoForbiddenConsoleData(value: unknown): void {
  const text = JSON.stringify(value);
  for (const forbidden of [
    "/home/ubuntu",
    "/tmp/",
    "telegram",
    "Telegram",
    "feishu",
    "open_id",
    "union_id",
    "chatId",
    "telegramChatId",
    "callback_data",
    "token=",
    "pid=",
    "processId",
    "rawTerminal",
    "stdout",
    "stderr",
    "cv_1111222233334444",
    "wk_aaaabbbbccccdddd",
    "answer-safe-1",
    "pi_safe_1"
  ]) {
    assert.equal(text.includes(forbidden), false, `leaked forbidden marker ${forbidden}: ${text}`);
  }
}

function visitShape(value: unknown, visitor: (node: unknown, key?: string) => void, key?: string): void {
  visitor(value, key);
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      visitShape(item, visitor);
    }
    return;
  }
  for (const [childKey, childValue] of Object.entries(value)) {
    visitShape(childValue, visitor, childKey);
  }
}
