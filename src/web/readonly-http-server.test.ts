import test from "node:test";
import assert from "node:assert/strict";

import type { AddressInfo } from "node:net";

import { createReadonlyAccessGate } from "./readonly-access.js";
import { createReadonlyHttpServer } from "./readonly-http-server.js";
import type { WebReadonlyViewModelProvider } from "../service/web-readonly-view-model.js";

const token = "local-test-token";

function makeProvider(calls: string[], options: { throwOnHome?: boolean } = {}): WebReadonlyViewModelProvider {
  return {
    getHomeViewModel() {
      calls.push("home");
      if (options.throwOnHome) {
        throw new Error("boom stack secret /tmp/secret-store messageId=123");
      }
      return {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_home",
        state: "available",
        operator: { binding: "available" },
        workspaces: [
          {
            workspaceId: "wk_safe_1",
            label: "<script>alert('x')</script> Console /home/ubuntu/secret token=abc callback_data=approve messageId=5",
            availability: "available",
            conversationCount: 1,
            pinned: true,
            lastActivityAt: "2026-04-25T12:00:00.000Z",
            lastSuccessAt: null,
            source: "recent"
          }
        ],
        recentConversations: [
          {
            conversationId: "cv_1234567890abcdef",
            conversationHandle: "cv_1234567890abcdef",
            workspaceId: "wk_safe_1",
            title: "Need <b>escape</b> & no submit approve interrupt upload switch resume",
            status: "running",
            failureReason: null,
            archived: false,
            createdAt: "2026-04-25T10:00:00.000Z",
            lastActivityAt: "2026-04-25T12:00:00.000Z",
            lastTurnStatus: "running",
            finalAnswerAvailable: true
          }
        ],
        runtime: {
          state: "available",
          activeTurns: [
            {
              sessionId: "session-1",
              status: "running",
              summary: "safe <img src=x onerror=alert(1)>",
              blockedReason: null
            }
          ]
        },
        readiness: { state: "ready", missingGates: [] },
        warnings: []
      };
    },
    listWorkspaceViewModels() {
      calls.push("workspaces");
      return {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_workspaces",
        state: "available",
        workspaces: [],
        warnings: []
      };
    },
    listWorkspaceConversationViewModels(workspaceId: string) {
      calls.push(`workspace:${workspaceId}`);
      return {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_workspace_conversations",
        state: "available",
        workspaceId,
        conversations: [
          {
            conversationId: "cv_1234567890abcdef",
            conversationHandle: "cv_1234567890abcdef",
            workspaceId,
            title: "Readonly detail",
            status: "completed",
            failureReason: null,
            archived: false,
            createdAt: "2026-04-25T10:00:00.000Z",
            lastActivityAt: "2026-04-25T12:00:00.000Z",
            lastTurnStatus: "completed",
            finalAnswerAvailable: true
          }
        ],
        emptyState: null,
        warnings: []
      };
    },
    getConversationResultViewModel(conversationHandle: string) {
      calls.push(`conversation:${conversationHandle}`);
      return {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_conversation_result",
        state: "available",
        conversation: {
          conversationId: conversationHandle,
          conversationHandle,
          workspaceId: "wk_safe_1",
          title: "Readonly detail",
          workspaceLabel: "Console Core",
          status: "completed",
          failureReason: null,
          archived: false,
          createdAt: "2026-04-25T10:00:00.000Z",
          lastActivityAt: "2026-04-25T12:00:00.000Z"
        },
        answers: [],
        runtime: { state: "degraded", activeTurns: [] },
        pendingInteractions: { state: "unavailable", pendingInteractions: [] },
        readiness: { state: "ready", missingGates: [] },
        warnings: []
      };
    },
    getConversationArtifactCatalogViewModel(sessionId: string) {
      calls.push(`artifacts:${sessionId}`);
      return {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_conversation_artifacts",
        state: "empty",
        conversationId: sessionId,
        artifacts: [],
        selectedArtifact: null,
        emptyState: "no_artifacts",
        warnings: []
      };
    },
    getRuntimeContextViewModel() {
      calls.push("runtime");
      return {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_runtime_context",
        state: "available",
        activeTurns: [],
        warnings: []
      };
    },
    getPendingInteractionsViewModel() {
      calls.push("interactions");
      return {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_pending_interactions",
        state: "available",
        pendingInteractions: [],
        warnings: []
      };
    },
    getReadinessGuardrailViewModel() {
      calls.push("readiness");
      return {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_readiness_guardrails",
        state: "ready",
        checkedAt: "2026-04-26T00:00:00.000Z",
        activePack: null,
        capabilities: [],
        missingGates: [],
        warnings: []
      };
    }
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

async function get(url: string, bearer?: string): Promise<{ status: number; text: string; headers: Headers }> {
  const init: RequestInit = bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {};
  const response = await fetch(url, init);
  return { status: response.status, text: await response.text(), headers: response.headers };
}

test("disabled or missing token denies generically and does not invoke provider", async () => {
  for (const access of [
    createReadonlyAccessGate({ enabled: false, token }),
    createReadonlyAccessGate({ enabled: true })
  ]) {
    const calls: string[] = [];
    await withServer({ provider: makeProvider(calls), access }, async (baseUrl) => {
      const result = await get(`${baseUrl}/`);
      assert.equal(result.status, 404);
      assert.match(result.text, /Not found/);
      assert.equal(result.text.includes("token"), false);
      assert.deepEqual(calls, []);
    });
  }
});

test("wrong or missing bearer denies generically and does not invoke provider", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    for (const bearer of [undefined, "wrong-token"]) {
      const result = await get(`${baseUrl}/`, bearer);
      assert.equal(result.status, 404);
      assert.match(result.text, /Not found/);
      assert.equal(result.text.includes("Bearer"), false);
      assert.deepEqual(calls, []);
    }

    const urlToken = await get(`${baseUrl}/?token=${token}`);
    assert.equal(urlToken.status, 404);
    assert.match(urlToken.text, /Not found/);
    assert.deepEqual(calls, []);
  });
});

test("authenticated state route invokes only expected provider method", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    const result = await get(`${baseUrl}/runtime`, token);
    assert.equal(result.status, 200);
    assert.match(result.text, /Runtime/);
    assert.deepEqual(calls, ["runtime"]);
  });
});

test("authenticated HTML escapes hostile strings and emits no raw script/action/form/control content", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    const result = await get(`${baseUrl}/`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["home"]);
    assert.match(result.text, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(result.text, /Codex Console/);
    assert.match(result.text, /Owner preview/);
    assert.match(result.text, /read-only/i);
    assert.match(result.text, /<header class="console-shell__header">/);
    assert.match(result.text, /<nav class="console-shell__nav" aria-label="Console navigation">/);
    for (const [href, label] of [
      ["/", "Home"],
      ["/workspaces", "Workspaces"],
      ["/interactions", "Pending"],
      ["/runtime", "Runtime"],
      ["/readiness", "Readiness"]
    ] as const) {
      assert.match(result.text, new RegExp(`<a[^>]*href="${href.replace("/", "\\/")}"[^>]*>${label}</a>`), `missing nav link ${href}: ${result.text}`);
    }
    assert.match(result.text, /class="console-card"/);
    assert.match(result.text, /Recent conversations/);
    assert.match(result.text, /Active turns/);
    assert.equal(result.text.includes("<table"), false, `home should use card/list shell, not primary tables: ${result.text}`);
    assert.equal(result.text.includes("<script>"), false);
    assert.equal(result.text.includes("<img"), false);
    assert.match(result.text, /&lt;script&gt;alert/);
    assert.match(result.text, /&lt;b&gt;escape&lt;\/b&gt;/);
    for (const forbidden of ["/home/ubuntu/secret", "token=abc", "callback_data", "messageId"]) {
      assert.equal(result.text.includes(forbidden), false, `rendered forbidden raw value ${forbidden}: ${result.text}`);
    }
    assert.match(result.text, /href="\/workspaces\/wk_safe_1\/conversations"/);
    assert.match(result.text, /href="\/conversations\/cv_1234567890abcdef"/);
    assert.equal(result.text.includes("/sessions/"), false);
    for (const forbidden of ["<form", "<button", "<input", "onclick", "download=", "?token", "href=\"#", "submit", "approve", "interrupt", "upload", "switch", "resume"]) {
      assert.equal(result.text.toLowerCase().includes(forbidden), false, `rendered forbidden content ${forbidden}: ${result.text}`);
    }
  });
});

test("authenticated conversation detail route uses only opaque handles and keeps security headers", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    const result = await get(`${baseUrl}/conversations/cv_1234567890abcdef`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["conversation:cv_1234567890abcdef"]);
    assert.match(result.text, /Conversation\/task detail/);
    assert.match(result.text, /<section class="console-panel console-result" aria-labelledby="result-heading">/);
    assert.match(result.text, /Final answer\/result/);
    assert.match(result.text, /Final answer body unavailable: this run has no sanitized Web-readable answer source yet\./);
    assert.match(result.text, /Pending interactions/);
    assert.match(result.text, /Runtime/);
    assert.match(result.text, /Readiness/);
    assert.match(result.text, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(result.text, /Readonly detail/);
    assert.equal(result.text.includes("/sessions/"), false);
    assert.equal(result.text.includes("session-1"), false);
    for (const forbidden of [token, "/home/ubuntu/secret", "callback_data", "messageId", "<form", "<button", "<input", "onclick", "download=", "?token", "href=\"#"]) {
      assert.equal(result.text.includes(forbidden), false, `detail leaked ${forbidden}: ${result.text}`);
    }
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.match(result.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.equal(result.headers.get("x-content-type-options"), "nosniff");
    assert.match(result.headers.get("content-type") ?? "", /^text\/html; charset=utf-8/);
  });
});

test("raw session and unsafe conversation route parts are generic 404s", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    for (const path of [
      "/sessions/session-1",
      "/sessions/session-1/artifacts",
      "/conversations/session-1",
      "/conversations/cv_1234567890abcdeg",
      "/conversations/%2Ftmp%2Fsecret",
      "/workspaces/%2Ftmp%2Fsecret/conversations"
    ]) {
      const result = await get(`${baseUrl}${path}`, token);
      assert.equal(result.status, 404, path);
      assert.match(result.text, /Not found/);
      assert.equal(result.text.includes("session-1"), false);
      assert.equal(result.text.includes("/tmp/secret"), false);
    }
    assert.deepEqual(calls, []);
  });
});

test("state responses include no-store, CSP, nosniff, and HTML charset headers", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    const result = await get(`${baseUrl}/workspaces`, token);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.match(result.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.equal(result.headers.get("x-content-type-options"), "nosniff");
    assert.match(result.headers.get("content-type") ?? "", /^text\/html; charset=utf-8/);
  });
});

test("unknown route and provider error are generic without stack traces", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls, { throwOnHome: true }), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    const unknown = await get(`${baseUrl}/unknown`, token);
    assert.equal(unknown.status, 404);
    assert.match(unknown.text, /Not found/);
    assert.deepEqual(calls, []);

    const errored = await get(`${baseUrl}/`, token);
    assert.equal(errored.status, 500);
    assert.match(errored.text, /Temporarily unavailable/);
    for (const forbidden of ["boom", "secret", "/tmp/secret-store", "messageId", "Error:", " at "]) {
      assert.equal(errored.text.includes(forbidden), false, `error leaked ${forbidden}: ${errored.text}`);
    }
  });
});
