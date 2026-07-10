import assert from "node:assert/strict";
import test from "node:test";

import type { SessionRow } from "../types.js";
import {
  SIDE_ALLOWED_COMMANDS,
  SIDE_BOUNDARY_PROMPT,
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

function harness(options: { active?: SessionRow | null; version?: string | null; capacity?: boolean } = {}) {
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
    }
  };
  const client = {
    readConfig: async () => { events.push("read-config"); return { config: {}, origins: {} }; },
    forkSideThread: async (value: unknown) => { events.push("fork"); forkOptions.push(value); return { thread: { id: "side-thread", turns: [] }, cwd: "/project", model: "m" }; },
    injectThreadItems: async (_id: string, value: unknown[]) => { events.push("inject"); injections.push(value); },
    unsubscribeThread: async () => { events.push("unsubscribe"); },
    interruptTurn: async () => undefined
  };
  const deps = {
    getStore: () => store,
    ensureAppServerAvailable: async () => client,
    getCodexVersion: () => options.version === undefined ? "codex-cli 0.144.1" : options.version,
    getRunningTurnCapacity: () => ({ allowed: options.capacity ?? true, limit: 2, running: 0 }),
    getActiveTurn: () => null,
    startTextTurn: async (_chatId: string, _side: SessionRow, text: string) => { events.push(`start:${text}`); },
    syncCurrentSessionCard: async (_chatId: string, reason: string) => { events.push(`sync:${reason}`); },
    surfacePendingInteractions: async () => undefined, expireSideInteractions: async () => undefined,
    clearSideTransientInput: () => undefined, releaseHeldTerminalResults: async () => 0,
    getParentStatus: () => "idle" as const, parentNeedsAction: () => false, countHeldResults: () => 0,
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

test("capacity refuses before config or fork", async () => {
  const h = harness({ capacity: false }); await h.coordinator.handleCommand("chat", "");
  assert.deepEqual(h.events, []); assert.match(h.messages[0] ?? "", /capacity|running/i);
});

test("idle, running, and blocked parents create; bare waits and inline starts after activation", async () => {
  for (const status of ["idle", "running", "failed"] as const) {
    const h = harness({ active: session({ status }) });
    await h.coordinator.handleCommand("chat", status === "running" ? " explain this failure " : "");
    assert.deepEqual(h.events, status === "running"
      ? ["read-config", "fork", "inject", "create-side", "sync:side_entered", "start:explain this failure"]
      : ["read-config", "fork", "inject", "create-side", "sync:side_entered"]);
  }
});

test("config instructions and effective model/effort are passed to fork; boundary is injected", async () => {
  const h = harness({ active: session({ selectedModel: "selected", selectedReasoningEffort: "high" }) });
  h.client.readConfig = async () => ({ config: { model: "fallback", model_reasoning_effort: "low" as const,
    developer_instructions: "existing" }, origins: {} });
  await h.coordinator.handleCommand("chat", "");
  assert.deepEqual(h.forkOptions[0], { threadId: "parent-thread", cwd: "/project", model: "selected",
    reasoningEffort: "high", developerInstructions: `existing\n\n${(h.forkOptions[0] as any).developerInstructions.split("\n\n").at(-1)}` });
  assert.deepEqual(h.injections[0], [{ type: "message", role: "user", content: [{ type: "input_text", text: SIDE_BOUNDARY_PROMPT }] }]);
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
  await inject.coordinator.handleCommand("chat", ""); assert.deepEqual(inject.events, ["read-config", "fork", "unsubscribe"]);
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
  assert.ok(h.events.includes("unsubscribe")); assert.match(h.messages.at(-1) ?? "", /already open|session changed/i);
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
