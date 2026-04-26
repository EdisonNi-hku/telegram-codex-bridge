import test from "node:test";
import assert from "node:assert/strict";

import type { AddressInfo } from "node:net";

import { createReadonlyAccessGate } from "./readonly-access.js";
import { createReadonlyHttpServer } from "./readonly-http-server.js";
import type {
  WebReadonlyConversationRow,
  WebReadonlyConversationResultViewModel,
  WebReadonlyPendingInteractionViewRow,
  WebReadonlyReadinessGuardrailViewModel,
  WebReadonlyRuntimeContextViewModel,
  WebReadonlyViewModelProvider
} from "../service/web-readonly-view-model.js";

const token = "local-test-token";

function makeProvider(
  calls: string[],
  options: {
    throwOnHome?: boolean;
    homeWorkspaces?: ReturnType<WebReadonlyViewModelProvider["getHomeViewModel"]>["workspaces"];
    homeConversations?: WebReadonlyConversationRow[];
    workspaceConversations?: WebReadonlyConversationRow[];
    detailAnswers?: WebReadonlyConversationResultViewModel["answers"];
    pendingInteractions?: WebReadonlyPendingInteractionViewRow[];
    homePendingInteractions?: WebReadonlyPendingInteractionViewRow[];
    detailPendingInteractions?: WebReadonlyPendingInteractionViewRow[];
    runtime?: WebReadonlyRuntimeContextViewModel;
    readiness?: WebReadonlyReadinessGuardrailViewModel;
  } = {}
): WebReadonlyViewModelProvider {
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
        workspaces: options.homeWorkspaces ?? [
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
        recentConversations: options.homeConversations ?? [
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
        runtime: options.runtime
          ? { state: options.runtime.state, activeTurns: options.runtime.activeTurns }
          : {
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
        pendingInteractions: {
          state: options.homePendingInteractions ? "available" : "unavailable",
          pendingInteractions: options.homePendingInteractions ?? []
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
        conversations: options.workspaceConversations ?? [
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
        answers: options.detailAnswers ?? [],
        runtime: { state: "degraded", activeTurns: [] },
        pendingInteractions: {
          state: options.detailPendingInteractions ? "available" : "unavailable",
          pendingInteractions: options.detailPendingInteractions ?? []
        },
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
      return options.runtime ?? {
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
        pendingInteractions: options.pendingInteractions ?? [],
        warnings: []
      };
    },
    getReadinessGuardrailViewModel() {
      calls.push("readiness");
      return options.readiness ?? {
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

test("runtime page renders owner-language runtime settings panels without action controls or internals", async () => {
  const calls: string[] = [];
  await withServer({
    provider: makeProvider(calls, {
      runtime: {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_runtime_context",
        state: "degraded",
        activeTurns: [
          {
            sessionId: "session-secret-1",
            status: "running",
            summary: "Codex is working from /tmp/private token=abc callback_data=raw messageId=55",
            blockedReason: null
          },
          {
            sessionId: "session-secret-2",
            status: "blocked",
            summary: null,
            blockedReason: "Waiting on safe owner context from /home/ubuntu/private"
          }
        ],
        warnings: ["runtime source unavailable at /sessions/session-secret-1", "telegramChatId=999 messageId=55"]
      }
    }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/runtime`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["runtime"]);
    for (const copy of [
      "Current operating state",
      "Active conversation/task turns",
      "Settings / access posture",
      "Owner/private",
      "Read-only preview",
      "Denied by default",
      "Actions are not enabled",
      "Degraded",
      "Unavailable",
      "Setup needed"
    ]) {
      assert.match(result.text, new RegExp(escapeRegExp(copy)), `missing runtime owner copy ${copy}: ${result.text}`);
    }
    assert.match(result.text, /Codex is working/);
    assert.match(result.text, /Progress is stopped until required owner interaction is resolved\./);
    assertWebPanelHasNoActionsOrInternals(result.text);
  });
});

test("readiness page renders owner-language capability and access posture without unsafe support claims", async () => {
  const calls: string[] = [];
  await withServer({
    provider: makeProvider(calls, {
      readiness: {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_readiness_guardrails",
        state: "degraded",
        checkedAt: "2026-04-26T00:00:00.000Z",
        activePack: "feishu token=abc /tmp/pack callback_data=raw",
        capabilities: [
          { key: "codex_installed", label: "Codex installed", declared: "present", configured: "present", observed: "present", uxExposed: "missing" },
          { key: "codex_authenticated", label: "Codex authenticated", declared: "present", configured: "missing", observed: "missing", uxExposed: "missing" },
          { key: "app_server", label: "App server", declared: "present", configured: "unknown", observed: "unknown", uxExposed: "missing" },
          { key: "operator_binding", label: "Owner binding", declared: "present", configured: "present", observed: "present", uxExposed: "missing" }
        ],
        missingGates: [
          "setup needed at /home/ubuntu/.codex",
          "messageId=12 callback_data=approve token=secret"
        ],
        warnings: ["telegramChatId=999 /sessions/session-secret-1"]
      }
    }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/readiness`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["readiness"]);
    for (const copy of [
      "Baseline capability/readiness matrix",
      "Declared",
      "Configured",
      "Observed",
      "UX exposed",
      "Setup / access posture",
      "Owner/private",
      "Denied by default",
      "Read-only preview",
      "Setup needed",
      "not a public support claim",
      "public support is not claimed"
    ]) {
      assert.match(result.text, new RegExp(escapeRegExp(copy)), `missing readiness owner copy ${copy}: ${result.text}`);
    }
    for (const label of ["Codex installed", "Codex authenticated", "App server", "Owner binding"]) {
      assert.match(result.text, new RegExp(escapeRegExp(label)), `missing readiness capability ${label}: ${result.text}`);
    }
    assertWebPanelHasNoActionsOrInternals(result.text);
    assert.equal(result.text.includes("activePack"), false);
    assert.equal(result.text.includes("codex_installed"), false);
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
    assert.match(result.text, /Personal workspace/);
    assert.match(result.text, /View-only preview/);
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
    assert.match(result.text, /Recent results/);
    assert.match(result.text, /Active \/ needs attention/);
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

test("home renders a product dashboard with personal workflow sections", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    const result = await get(`${baseUrl}/`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["home"]);
    assert.match(result.text, /<h2 id="page-heading">Codex Console<\/h2>/);
    assert.match(result.text, /Your personal console for continuing Codex work, reviewing results, and browsing projects\./);
    for (const heading of [
      "Continue working",
      "Active / needs attention",
      "Recent results",
      "Projects / workspaces"
    ]) {
      assert.match(result.text, new RegExp(`<h2[^>]*>${escapeRegExp(heading)}</h2>`), `missing dashboard section ${heading}: ${result.text}`);
    }
    assert.match(result.text, /View-only preview/);
    assert.match(result.text, /Open/);
    assert.equal(result.text.includes("Current state"), false, `home should not be centered on status metrics: ${result.text}`);
    assert.equal(result.text.includes("Settings / access posture"), false, `home should keep access posture off the landing dashboard: ${result.text}`);
  });
});

test("home empty state is friendly product copy, not degraded/security copy", async () => {
  const calls: string[] = [];
  await withServer({
    provider: makeProvider(calls, {
      homeWorkspaces: [],
      homeConversations: [],
      runtime: {
        generatedAt: "2026-04-26T00:00:00.000Z",
        prototypeOnly: true,
        readonly: true,
        pageId: "web_runtime_context",
        state: "available",
        activeTurns: [],
        warnings: []
      }
    }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["home"]);
    for (const copy of [
      "No active work needs attention right now.",
      "Recent results will appear here after Codex finishes work.",
      "Projects and workspaces will appear here once the bridge has recent workspace history."
    ]) {
      assert.match(result.text, new RegExp(escapeRegExp(copy)), `missing friendly empty copy ${copy}: ${result.text}`);
    }
    assert.equal(result.text.includes("degraded"), false, `empty home should not lead with degraded copy: ${result.text}`);
    assert.equal(result.text.includes("denied-by-default"), false, `empty home should not lead with security posture: ${result.text}`);
  });
});


test("authenticated HTML includes CSP-compatible app shell stylesheet", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    const result = await get(`${baseUrl}/`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["home"]);
    assert.match(result.headers.get("content-security-policy") ?? "", /style-src 'sha256-[A-Za-z0-9+/=]+'/);
    assert.equal(result.headers.get("content-security-policy")?.includes("unsafe-inline"), false);
    assert.match(result.text, /<style>\n:root \{/);
    assert.match(result.text, /max-width: min\(1120px, calc\(100% - 32px\)\)/);
    assert.match(result.text, /overflow-wrap: anywhere/);
    assert.match(result.text, /white-space: pre-wrap/);
    assert.match(result.text, /min-height: 44px/);
    assert.match(result.text, /@media \(max-width: 640px\)/);
    assert.equal(result.text.includes("<link"), false);
    assert.equal(result.text.includes('style="'), false);
  });
});

test("home surfaces concrete owner attention from pending interactions without raw internals", async () => {
  const calls: string[] = [];
  const rows: WebReadonlyPendingInteractionViewRow[] = [
    pendingInteractionFixture("pi_home_question", "cv_aaaaaaaaaaaaaaaa", "awaiting_user_input", "question", "Codex needs a product decision."),
    pendingInteractionFixture("pi_home_approval", "cv_bbbbbbbbbbbbbbbb", "pending_approval", "codex_approval", "A safe change needs owner review.")
  ];

  await withServer({
    provider: makeProvider(calls, { homePendingInteractions: rows }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["home"]);
    assert.match(result.text, /Owner attention/);
    assert.match(result.text, /2 items need owner attention/);
    assert.match(result.text, /Codex needs a product decision\./);
    assert.match(result.text, /A safe change needs owner review\./);
    assert.match(result.text, /Needs answer/);
    assert.match(result.text, /Approval needed/);
    assertPendingSurfaceHasNoActionsOrInternals(result.text);
    for (const raw of ["pi_home_question", "pi_home_approval", "awaiting_user_input", "pending_approval", "codex_approval"]) {
      assert.equal(result.text.includes(raw), false, `home leaked raw pending value ${raw}: ${result.text}`);
    }
  });
});


test("authenticated conversation detail route uses only opaque handles and keeps security headers", async () => {
  const calls: string[] = [];
  await withServer({ provider: makeProvider(calls), access: createReadonlyAccessGate({ enabled: true, token }) }, async (baseUrl) => {
    const result = await get(`${baseUrl}/conversations/cv_1234567890abcdef`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["conversation:cv_1234567890abcdef"]);
    assert.match(result.text, /Task page/);
    assert.match(result.text, /<h2 id="detail-heading">Readonly detail<\/h2>/);
    assert.match(result.text, /Last updated/);
    assert.match(result.text, /View-only preview/);
    assert.match(result.text, /<section class="console-panel console-result" aria-labelledby="result-heading">/);
    assert.match(result.text, /Result/);
    assert.match(result.text, /No Web-ready final answer has been captured yet\. When Codex finishes with a shareable result, it will appear in this panel\./);
    assert.match(result.text, /Needs attention/);
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

test("authenticated conversation detail renders available final-answer body escaped and readable", async () => {
  const calls: string[] = [];
  await withServer({
    provider: makeProvider(calls, {
      detailAnswers: [
        {
          answerId: "answer-safe",
          kind: "final_answer",
          deliveryState: "delivered",
          createdAt: "2026-04-25T12:10:00.000Z",
          body: {
            state: "available",
            text: "Useful result:\n- Render <result> & \"details\" safely."
          },
          summary: "Final answer body was provided by a Web-safe source."
        }
      ]
    }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/conversations/cv_1234567890abcdef`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["conversation:cv_1234567890abcdef"]);
    assert.match(result.text, /<pre class="console-result-body">Useful result:/);
    assert.match(result.text, /Render &lt;result&gt; &amp; &quot;details&quot; safely\./);
    assert.equal(result.text.includes("<result>"), false);
    assert.equal(result.text.includes("Final answer body unavailable"), false);
  });
});

test("authenticated conversation detail explains rejected final-answer body source", async () => {
  const calls: string[] = [];
  await withServer({
    provider: makeProvider(calls, {
      detailAnswers: [
        {
          answerId: "answer-unsafe",
          kind: "final_answer",
          deliveryState: "delivered",
          createdAt: "2026-04-25T12:10:00.000Z",
          body: { state: "unavailable", reason: "unsafe_final_answer_body" },
          summary: "Final answer body was rejected by the Web safety filter."
        }
      ]
    }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/conversations/cv_1234567890abcdef`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["conversation:cv_1234567890abcdef"]);
    assert.match(result.text, /This result is available in the bridge conversation, but it is not shown in the Web preview yet\./);
    assert.equal(result.text.includes("Web safety filter"), false);
    assert.equal(result.text.includes("<table"), false);
  });
});

test("authenticated pending interactions route renders read-only owner attention cards by status without action controls", async () => {
  const calls: string[] = [];
  const rows: WebReadonlyPendingInteractionViewRow[] = [
    pendingInteractionFixture("pi_pending_question", "cv_aaaaaaaaaaaaaaaa", "awaiting_user_input", "question", "Codex needs a product decision."),
    pendingInteractionFixture("pi_pending_approval", "cv_bbbbbbbbbbbbbbbb", "pending_approval", "codex_approval", "A safe change needs owner review."),
    pendingInteractionFixture("pi_resolved", "cv_cccccccccccccccc", "resolved", "question", "The owner interaction was resolved."),
    pendingInteractionFixture("pi_expired", "cv_dddddddddddddddd", "expired", "question", "This prompt is no longer current."),
    pendingInteractionFixture("pi_stale", "cv_eeeeeeeeeeeeeeee", "stale", "approval", "The visible state may be stale."),
    pendingInteractionFixture("pi_duplicate", "cv_ffffffffffffffff", "duplicate", "question", "A newer owner prompt replaced this one."),
    pendingInteractionFixture("pi_failed", "cv_1111111111111111", "failed", "interaction", "The pending item could not be read safely."),
    pendingInteractionFixture("pi_unavailable", "cv_2222222222222222", "source_unavailable", "interaction", null, "unavailable")
  ];

  await withServer({
    provider: makeProvider(calls, { pendingInteractions: rows }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/interactions`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["interactions"]);
    assert.match(result.text, /Pending\/Approvals/);
    assert.match(result.text, /Responses are not enabled in this preview\./);
    for (const heading of ["Needs owner attention", "Resolved or duplicate", "Stale or expired", "Unavailable or failed"]) {
      assert.match(result.text, new RegExp(`<h3>${escapeRegExp(heading)}</h3>`), `missing pending group ${heading}: ${result.text}`);
    }
    for (const label of ["Needs answer", "Approval needed", "Resolved", "Expired", "Stale", "Duplicate", "Failed", "Unavailable"]) {
      assert.match(result.text, new RegExp(`class="console-badge">${escapeRegExp(label)}</span>`), `missing pending label ${label}: ${result.text}`);
    }
    for (const copy of [
      "Codex asked a question; responses are not enabled in this preview.",
      "Codex requested an approval; responses are not enabled in this preview.",
      "This owner interaction is already resolved; no Web action is available.",
      "This owner interaction expired or is no longer current; refresh or use the current bridge chat if needed.",
      "This owner interaction may be stale; refresh before relying on it.",
      "This owner interaction appears to duplicate another item; use the current item in the bridge chat if needed.",
      "This owner interaction could not be read safely; use the current bridge chat if needed.",
      "Pending interaction data is unavailable from the safe reader."
    ]) {
      assert.match(result.text, new RegExp(escapeRegExp(copy)), `missing pending copy ${copy}: ${result.text}`);
    }
    assert.match(result.text, /href="\/conversations\/cv_aaaaaaaaaaaaaaaa"/);
    assert.match(result.text, /href="\/conversations\/cv_bbbbbbbbbbbbbbbb"/);
    assertPendingSurfaceHasNoActionsOrInternals(result.text);
    for (const raw of ["awaiting_user_input", "pending_approval", "source_unavailable", "codex_approval", "pi_pending_question", "pi_pending_approval"]) {
      assert.equal(result.text.includes(raw), false, `raw pending value leaked ${raw}: ${result.text}`);
    }
  });
});

test("conversation detail pending panel shares read-only pending cards and action-disabled copy", async () => {
  const calls: string[] = [];
  const rows: WebReadonlyPendingInteractionViewRow[] = [
    pendingInteractionFixture("pi_detail_question", "cv_1234567890abcdef", "awaiting_user_input", "question", "Codex needs a sizing answer.")
  ];

  await withServer({
    provider: makeProvider(calls, { detailPendingInteractions: rows }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/conversations/cv_1234567890abcdef`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["conversation:cv_1234567890abcdef"]);
    assert.match(result.text, /Needs attention/);
    assert.match(result.text, /Needs owner attention/);
    assert.match(result.text, /Codex needs a sizing answer\./);
    assert.match(result.text, /Codex asked a question; responses are not enabled in this preview\./);
    assert.match(result.text, /Responses are not enabled in this preview\./);
    assertPendingSurfaceHasNoActionsOrInternals(result.text);
    assert.equal(result.text.includes("pi_detail_question"), false, `raw pending id leaked: ${result.text}`);
  });
});

test("home recent conversations use user-language state groups and copy", async () => {
  const calls: string[] = [];
  const rows: WebReadonlyConversationRow[] = [
    conversationFixture("cv_aaaaaaaaaaaaaaaa", "Answer product question", "pending_question", false),
    conversationFixture("cv_bbbbbbbbbbbbbbbb", "Approve safe change", "pending_approval", false),
    conversationFixture("cv_cccccccccccccccc", "Blocked on owner input", "blocked", false),
    conversationFixture("cv_dddddddddddddddd", "Run implementation", "running", false),
    conversationFixture("cv_eeeeeeeeeeeeeeee", "Finished slice", "completed", true),
    conversationFixture("cv_ffffffffffffffff", "Failed check", "failed", false),
    conversationFixture("cv_1111111111111111", "Partial state", "degraded", false),
    conversationFixture("cv_2222222222222222", "Unknown state", "source_unknown", false)
  ];

  await withServer({
    provider: makeProvider(calls, { homeConversations: rows }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["home"]);
    for (const heading of ["Needs attention", "Running now", "Recently completed", "Other/Older"]) {
      assert.match(result.text, new RegExp(`<h3>${heading}</h3>`), `missing grouped heading ${heading}: ${result.text}`);
    }
    for (const label of ["Needs answer", "Approval needed", "Blocked", "Running", "Done", "Failed", "Degraded", "Unavailable"]) {
      assert.match(result.text, new RegExp(`class="console-badge">${label}</span>`), `missing label ${label}: ${result.text}`);
    }
    for (const copy of [
      "Codex asked a question; the answer lane is read-only until enabled.",
      "Codex requested an approval; the approval lane is read-only until enabled.",
      "Progress is stopped until required owner interaction is resolved.",
      "Codex is working; result will appear here when complete.",
      "Completion metadata or a final result is available.",
      "The task ended without a usable final result in this preview.",
      "State is partial, stale, or missing a safe source.",
      "The current state is unavailable or unknown from the safe reader."
    ]) {
      assert.match(result.text, new RegExp(escapeRegExp(copy)), `missing copy ${copy}: ${result.text}`);
    }
    for (const raw of ["pending_question", "pending_approval", "source_unknown"]) {
      assert.equal(result.text.includes(raw), false, `raw state leaked ${raw}: ${result.text}`);
    }
  });
});

test("workspace conversation list groups mixed states without exposing raw state enums", async () => {
  const calls: string[] = [];
  const rows: WebReadonlyConversationRow[] = [
    conversationFixture("cv_aaaaaaaaaaaaaaaa", "Needs approval", "pending_approval", false),
    conversationFixture("cv_bbbbbbbbbbbbbbbb", "Running task", "running", false),
    conversationFixture("cv_cccccccccccccccc", "Completed task", "done", true),
    conversationFixture("cv_dddddddddddddddd", "Unknown task", "state_unknown", false)
  ];

  await withServer({
    provider: makeProvider(calls, { workspaceConversations: rows }),
    access: createReadonlyAccessGate({ enabled: true, token })
  }, async (baseUrl) => {
    const result = await get(`${baseUrl}/workspaces/wk_safe_1/conversations`, token);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["workspace:wk_safe_1"]);
    for (const heading of ["Needs attention", "Running now", "Recently completed", "Other/Older"]) {
      assert.match(result.text, new RegExp(`<h3>${heading}</h3>`), `missing grouped heading ${heading}: ${result.text}`);
    }
    assert.match(result.text, /Approval needed/);
    assert.match(result.text, /Running/);
    assert.match(result.text, /Done/);
    assert.match(result.text, /Unavailable/);
    assert.match(result.text, /The current state is unavailable or unknown from the safe reader\./);
    for (const raw of ["pending_approval", "state_unknown"]) {
      assert.equal(result.text.includes(raw), false, `raw state leaked ${raw}: ${result.text}`);
    }
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

function conversationFixture(
  handle: string,
  title: string,
  status: string,
  finalAnswerAvailable: boolean
): WebReadonlyConversationRow {
  return {
    conversationId: handle,
    conversationHandle: handle,
    workspaceId: "wk_safe_1",
    title,
    status,
    failureReason: null,
    archived: false,
    createdAt: "2026-04-25T10:00:00.000Z",
    lastActivityAt: "2026-04-25T12:00:00.000Z",
    lastTurnStatus: status,
    finalAnswerAvailable
  };
}

function pendingInteractionFixture(
  interactionId: string,
  conversationId: string,
  status: string,
  kind: string,
  summaryText: string | null,
  availability: "available" | "unavailable" | "degraded" = "available"
): WebReadonlyPendingInteractionViewRow {
  return {
    interactionId,
    conversationId,
    sessionId: null,
    status,
    kind,
    createdAt: "2026-04-25T10:00:00.000Z",
    updatedAt: "2026-04-25T10:05:00.000Z",
    blockingReason: "Safe owner attention state.",
    summary: summaryText
      ? { state: "available", text: summaryText }
      : { state: "unavailable", reason: "pending_interaction_summary_not_provided" },
    availability,
    warnings: []
  };
}

function assertPendingSurfaceHasNoActionsOrInternals(html: string): void {
  const lower = html.toLowerCase();
  for (const forbidden of [
    "<form",
    "<button",
    "<input",
    "method=\"post\"",
    "form-action",
    "onclick",
    "callback_data",
    "callback:",
    "messageid",
    "platformmessageid",
    "telegramchatid",
    "feishuchatid",
    "token=",
    "?token",
    "/tmp/",
    "/home/",
    "/sessions/",
    "/approval-answer",
    "/question-answer",
    "/submit",
    "/interrupt"
  ]) {
    assert.equal(lower.includes(forbidden), false, `pending surface leaked forbidden content ${forbidden}: ${html}`);
  }
}

function assertWebPanelHasNoActionsOrInternals(html: string): void {
  const lower = html.toLowerCase();
  for (const forbidden of [
    token,
    "<form",
    "<button",
    "<input",
    "method=\"post\"",
    "action=",
    "onclick",
    "download=",
    "?token",
    "/tmp",
    "/home",
    "/sessions/",
    "callback_data",
    "callback:",
    "messageid",
    "platformmessageid",
    "telegramchatid",
    "feishuchatid",
    "chatid",
    "threadid",
    "session-secret",
    "raw platform",
    "/approval-answer",
    "/question-answer",
    "/submit",
    "/interrupt",
    " submit ",
    " approve ",
    " answer ",
    " interrupt "
  ]) {
    assert.equal(lower.includes(forbidden), false, `surface leaked forbidden content ${forbidden}: ${html}`);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
