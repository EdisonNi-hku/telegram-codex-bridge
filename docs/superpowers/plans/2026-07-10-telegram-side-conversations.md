# Telegram Side Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Telegram-only `/side` command that runs an ephemeral Codex fork beside the parent task, keeps routing and status unambiguous, and safely returns with held parent output delivered once.

**Architecture:** A persisted transient `side` session reuses the existing turn/runtime pipeline while a dedicated `SideConversationCoordinator` owns creation, command gating, return, and restart cleanup. The app-server boundary exposes ephemeral fork/injection/unsubscribe methods; the store hides side rows from normal history; interaction and terminal-delivery gates hold parent surfaces until the parent is restored.

**Tech Stack:** TypeScript, Node.js 24, `node:sqlite`, Codex app-server JSON-RPC, Telegram Bot API inline keyboards, Node test runner, `tsx`.

---

## File Structure

- Create `src/state/store-side-sessions.ts`: side-only persistence, parent lookup, atomic activation/restore/delete, startup recovery.
- Create `src/service/side-conversation-coordinator.ts`: side lifecycle, capability gate, per-chat serialization, token validation, command allowlist.
- Create `src/service/side-conversation-coordinator.test.ts`: isolated lifecycle, return, stale callback, and failure tests.
- Create `src/telegram/ui-side.ts`: side card, parent-status view, and running-return confirmation renderer.
- Modify `src/codex/app-server.ts` and its test: typed side protocol methods.
- Modify `src/core/domain/common.ts`, `src/types.ts`, and state modules: session kind, parent relation, held delivery state, restart notice type.
- Modify `src/telegram/commands.ts`, `src/telegram/ui-callbacks.ts`, `src/telegram/ui.ts`, and UI/router tests: `/side` registration and compact callback family.
- Modify `src/service/current-session-card-controller.ts`: render regular or side cards with reply markup through one pin/edit lifecycle.
- Modify `src/service/interaction-broker.ts`: persist but withhold parent interactions while side is active, then surface them on return.
- Modify `src/service/turn-coordinator.ts`: hold parent terminal results and release persisted results through the normal delivery surface.
- Modify `src/service.ts`: coordinator wiring, early `/side` interception, side command gating, callback dispatch, parent-card refresh, startup recovery ordering.
- Modify current product/architecture docs after behavior is verified.

## Task 1: Add the Codex Side Protocol Boundary

**Files:**
- Modify: `src/codex/app-server.ts`
- Test: `src/codex/app-server.test.ts`

- [ ] **Step 1: Write failing JSON-RPC contract tests**

Add tests that monkey-patch `request` and assert all three exact methods and payloads:

```ts
test("side thread RPCs use ephemeral fork, raw boundary injection, and unsubscribe", async () => {
  const client = new CodexAppServerClient("codex", "/tmp/app-server.log", testLogger);
  const calls: Array<{ method: string; params: unknown }> = [];
  (client as any).request = async (method: string, params: unknown) => {
    calls.push({ method, params });
    return method === "thread/fork"
      ? { thread: { id: "side-thread", turns: [] }, cwd: "/repo", model: "gpt-5.6-sol" }
      : {};
  };

  await client.forkSideThread({
    threadId: "parent-thread",
    cwd: "/repo",
    model: "gpt-5.6-sol",
    reasoningEffort: "max",
    developerInstructions: "existing\n\nside policy"
  });
  await client.injectThreadItems("side-thread", [{
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: "Side conversation boundary." }]
  }]);
  await client.unsubscribeThread("side-thread");

  assert.deepEqual(calls, [{
    method: "thread/fork",
    params: {
      threadId: "parent-thread",
      cwd: "/repo",
      model: "gpt-5.6-sol",
      ephemeral: true,
      developerInstructions: "existing\n\nside policy",
      config: { model_reasoning_effort: "max" }
    }
  }, {
    method: "thread/inject_items",
    params: {
      threadId: "side-thread",
      items: [{
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Side conversation boundary." }]
      }]
    }
  }, {
    method: "thread/unsubscribe",
    params: { threadId: "side-thread" }
  }]);
});
```

Also extend the `readConfig` response test so `developer_instructions` is typed and preserved.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --import tsx --test src/codex/app-server.test.ts
```

Expected: FAIL because `forkSideThread`, `injectThreadItems`, and `unsubscribeThread` do not exist.

- [ ] **Step 3: Implement the typed wrappers**

Add these public types and methods without changing regular `/fork`:

```ts
export interface SideThreadForkOptions {
  threadId: string;
  cwd: string;
  model?: string | null;
  reasoningEffort?: ReasoningEffort | null;
  developerInstructions: string;
}

async forkSideThread(options: SideThreadForkOptions): Promise<ThreadForkResult> {
  return await this.request<ThreadForkResult>("thread/fork", {
    threadId: options.threadId,
    cwd: options.cwd,
    ephemeral: true,
    developerInstructions: options.developerInstructions,
    ...(options.model ? { model: options.model } : {}),
    ...(options.reasoningEffort
      ? { config: { model_reasoning_effort: options.reasoningEffort } }
      : {})
  });
}

async injectThreadItems(threadId: string, items: unknown[]): Promise<void> {
  await this.request("thread/inject_items", { threadId, items });
}

async unsubscribeThread(threadId: string): Promise<void> {
  await this.request("thread/unsubscribe", { threadId });
}
```

Add `developer_instructions?: string | null` to `ConfigReadResult.config`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 test command. Expected: all app-server tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/codex/app-server.ts src/codex/app-server.test.ts
git commit -m "feat: add Codex side thread protocol"
```

## Task 2: Persist Transient Side Sessions Without Polluting History

**Files:**
- Create: `src/state/store-side-sessions.ts`
- Modify: `src/core/domain/common.ts`
- Modify: `src/types.ts`
- Modify: `src/state/store-records.ts`
- Modify: `src/state/store-open.ts`
- Modify: `src/state/store-sessions.ts`
- Modify: `src/state/store-runtime-artifacts.ts`
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

- [ ] **Step 1: Write failing migration and invariant tests**

Add tests that prove:

```ts
const parent = store.createSession({
  chatId: "chat-side",
  projectName: "Project",
  projectPath: "/repo",
  threadId: "parent-thread"
});
store.setActiveSession("chat-side", parent.sessionId);

const side = store.createSideSession({
  parentSessionId: parent.sessionId,
  threadId: "side-thread"
});

assert.equal(side.sessionKind, "side");
assert.equal(side.parentSessionId, parent.sessionId);
assert.equal(store.getActiveSession("chat-side")?.sessionId, side.sessionId);
assert.deepEqual(store.listSessions("chat-side").map((row) => row.sessionId), [parent.sessionId]);
assert.equal(store.listSessionsWithThreads().some((row) => row.sessionId === side.sessionId), false);

const restored = store.restoreParentAndDeleteSide(side.sessionId);
assert.equal(restored?.parent.sessionId, parent.sessionId);
assert.equal(store.getSessionById(side.sessionId), null);
assert.equal(store.getActiveSession("chat-side")?.sessionId, parent.sessionId);
```

Add negative cases for a missing parent, a side parent, different chat/project data, archiving/renaming a side, and hard-deleting a regular session. Add a migration test that opens a version-22 fixture and asserts existing rows map to `sessionKind: "regular"` and `parentSessionId: null`.

Add held-result tests:

```ts
const held = store.saveTerminalResultView({
  chatId: "chat-side",
  sessionId: parent.sessionId,
  threadId: "parent-thread",
  turnId: "turn-parent",
  kind: "final_answer",
  deliveryState: "held_for_side",
  previewHtml: "done",
  pages: ["done"]
});
assert.equal(store.countHeldTerminalResults(parent.sessionId), 1);
assert.deepEqual(
  store.claimHeldTerminalResults(parent.sessionId).map((row) => row.answerId),
  [held.answerId]
);
assert.equal(store.countHeldTerminalResults(parent.sessionId), 0);
assert.deepEqual(store.claimHeldTerminalResults(parent.sessionId), []);
```

- [ ] **Step 2: Run store tests and verify RED**

Run:

```bash
node --import tsx --test src/state/store.test.ts
```

Expected: FAIL on missing side APIs, session fields, migration 23, and `held_for_side` mapping.

- [ ] **Step 3: Add schema version 23 and shared types**

Add:

```ts
export type SessionKind = "regular" | "side";
export type TerminalDeliveryState =
  | "pending"
  | "held_for_side"
  | "visible"
  | "deferred_notice_visible";
export type RuntimeNoticeType =
  | "bridge_restart_recovery"
  | "side_restart_recovery"
  | "app_server_notice"
  | "terminal_delivery_deferred";
```

Extend `SessionRow`/`SessionRecord`/`sessionSelectColumns` with `sessionKind`/`session_kind` and `parentSessionId`/`parent_session_id`. Migration 23 must execute:

```sql
ALTER TABLE session ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'regular';
ALTER TABLE session ADD COLUMN parent_session_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_session_kind_parent
  ON session(session_kind, parent_session_id);
```

Update `initialSchema()` with the same two columns and set `CURRENT_SCHEMA_VERSION = 23`.

- [ ] **Step 4: Implement the side store boundary**

Define this exact public API in `store-side-sessions.ts` and delegate it through `BridgeStateStore`:

```ts
export interface SideRestartRecovery {
  chatId: string;
  sideSessionId: string;
  parentSessionId: string | null;
}

export interface StoreSideSessions {
  createSideSession(options: { parentSessionId: string; threadId: string }): SessionRow;
  getSideParent(sideSessionId: string): SessionRow | null;
  getActiveSideForParent(parentSessionId: string): SessionRow | null;
  listSideSessions(): SessionRow[];
  restoreParentAndDeleteSide(sideSessionId: string): { side: SessionRow; parent: SessionRow } | null;
  recoverSideSessionsAfterRestart(): SideRestartRecovery[];
}
```

`createSideSession` copies chat/project/model/effort/plan fields from a regular parent, inserts `display_name = 'Side: ' || parent.display_name`, sets `session_kind='side'`, and atomically changes `chat_binding.active_session_id`.

`restoreParentAndDeleteSide` validates the active relationship, switches the binding to the parent, then deletes only the side row in one transaction. `recoverSideSessionsAfterRestart` restores each valid parent or the most recent non-archived regular fallback, writes one `side_restart_recovery` notice, and deletes every side row idempotently.

Update all normal list/resume/project-stat/archive-reconcile queries with `session_kind = 'regular'`. Keep `getSessionById`, `getSessionByThreadId`, `getActiveSession`, status updates, and running-capacity queries able to see side rows. Reject archive, unarchive, rename, and auto-rename for `side`.

- [ ] **Step 5: Add atomic held-result claiming**

Map `held_for_side` without collapsing it to `pending` and add:

```ts
claimHeldTerminalResults(sessionId: string): TerminalResultViewRow[];
countHeldTerminalResults(sessionId: string): number;
```

`countHeldTerminalResults` performs a session-scoped `COUNT(*)` for `delivery_state='held_for_side'`. Inside one transaction, `claimHeldTerminalResults` selects the same state in ascending `created_at,rowid` order, updates only those IDs to `pending`, commits, and returns the mapped rows with `deliveryState: "pending"`.

- [ ] **Step 6: Run store tests and verify GREEN**

Run the Task 2 test command. Expected: all store tests pass, including migration fixtures.

- [ ] **Step 7: Commit**

```bash
git add src/core/domain/common.ts src/types.ts src/state/store-records.ts src/state/store-open.ts src/state/store-sessions.ts src/state/store-side-sessions.ts src/state/store-runtime-artifacts.ts src/state/store.ts src/state/store.test.ts
git commit -m "feat: persist transient side sessions"
```

## Task 3: Register `/side` and Build the Telegram Side Surface

**Files:**
- Create: `src/telegram/ui-side.ts`
- Modify: `src/telegram/ui.ts`
- Modify: `src/telegram/ui-callbacks.ts`
- Modify: `src/telegram/commands.ts`
- Test: `src/telegram/ui.test.ts`
- Test: `src/telegram/commands.test.ts`
- Test: `src/service/command-router.test.ts`
- Test: `src/service/callback-router.test.ts`
- Modify: `src/service/callback-router.ts`

- [ ] **Step 1: Write failing registry, renderer, and callback tests**

Assert Telegram includes `/side`, Feishu excludes it, help text documents both forms, and command routing reaches `handleSide`.

Add UI assertions for these view models:

```ts
const idle = buildSideSessionCardMessage({
  token: "tok",
  language: "zh",
  projectName: "ai_research",
  parentSessionName: "Main",
  sideStatus: "idle",
  parentStatus: "running",
  parentNeedsAction: false,
  heldResultCount: 0
});
assert.match(idle.text, /↪ Side/u);
assert.match(idle.text, /主会话：运行中/u);
assert.deepEqual(idle.replyMarkup.inline_keyboard.map((row) => row.map((button) => button.text)), [
  ["主任务状态", "返回主会话"]
]);

const approval = buildSideSessionCardMessage({
  token: "tok",
  language: "zh",
  projectName: "ai_research",
  parentSessionName: "Main",
  sideStatus: "idle",
  parentStatus: "running",
  parentNeedsAction: true,
  heldResultCount: 0
});
assert.equal(approval.replyMarkup.inline_keyboard[0]?.[0]?.text, "返回并处理审批");
```

Test running side controls, held-result label, parent-status view, return confirmation, English strings, HTML escaping, and absence of `undefined`.

Test all compact callbacks round-trip and remain at most 64 UTF-8 bytes:

```ts
assert.deepEqual(parseCallbackData(encodeSideStatusCallback("tok")), {
  kind: "side_status",
  token: "tok"
});
assert.deepEqual(parseCallbackData(encodeSideBackCallback("tok")), {
  kind: "side_back",
  token: "tok"
});
assert.deepEqual(parseCallbackData(encodeSideReturnConfirmCallback("tok")), {
  kind: "side_return_confirm",
  token: "tok"
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --import tsx --test src/telegram/ui.test.ts src/telegram/commands.test.ts src/service/command-router.test.ts src/service/callback-router.test.ts
```

Expected: FAIL because the side command, renderers, callbacks, and handlers do not exist.

- [ ] **Step 3: Implement the command registry changes**

Add `handleSide` to `TelegramCommandHandlerKey` and register:

```ts
{
  command: "side",
  handler: "handleSide",
  description: { zh: "开启临时 Side 对话", en: "Start a temporary side conversation" },
  helpLines: [{
    zh: "/side [问题] 开启临时 Side 对话；/side back 返回主会话",
    en: "/side [question] Start a temporary side conversation; /side back returns"
  }],
  telegramOnly: true
}
```

Change `buildTelegramCommands(language, activePack = "telegram")` to filter `telegramOnly` entries outside Telegram. Pass the active pack from service command sync. Keep `TELEGRAM_COMMANDS` as the Telegram default.

- [ ] **Step 4: Implement the renderer and v11 callback family**

Export these view types/functions from `ui-side.ts` and `ui.ts`:

```ts
export type SideParentStatus =
  | "idle" | "running" | "waiting_input" | "waiting_approval"
  | "completed" | "interrupted" | "failed" | "closed";

export interface SideCardViewModel {
  token: string;
  language: UiLanguage;
  projectName: string;
  parentSessionName: string;
  sideStatus: SessionStatus;
  parentStatus: SideParentStatus;
  parentNeedsAction: boolean;
  heldResultCount: number;
}

export function buildSideSessionCardMessage(view: SideCardViewModel): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
};

export function buildSideParentStatusMessage(view: SideCardViewModel): string;
export function buildSideReturnConfirmationMessage(token: string, language: UiLanguage): {
  text: string;
  replyMarkup: TelegramInlineKeyboardMarkup;
};
```

Use callback payloads `v11:sd:s:<token>`, `v11:sd:b:<token>`, `v11:sd:i:<token>`, `v11:sd:y:<token>`, and `v11:sd:n:<token>` for status, back, interrupt, confirm, and cancel. Add exhaustive router handlers with no extra acknowledgement before delegation.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 3 test command. Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/telegram/ui-side.ts src/telegram/ui.ts src/telegram/ui-callbacks.ts src/telegram/commands.ts src/telegram/ui.test.ts src/telegram/commands.test.ts src/service/command-router.test.ts src/service/callback-router.ts src/service/callback-router.test.ts
git commit -m "feat: add Telegram side command surfaces"
```

## Task 4: Implement Side Creation and Capability Gating

**Files:**
- Create: `src/service/side-conversation-coordinator.ts`
- Create: `src/service/side-conversation-coordinator.test.ts`

- [ ] **Step 1: Write failing creation tests**

Build a dependency harness and cover:

- no active parent
- parent without `threadId`
- Codex version below 0.144.1
- no free running-turn capacity
- active parent states `idle`, `running`, and blocked interaction
- bare `/side`
- `/side explain this failure`
- duplicate/nested `/side`
- config inheritance and existing developer-instruction append
- fork failure
- boundary injection failure with best-effort unsubscribe
- first side turn failure leaving an idle side open

The successful inline case must assert this order:

```ts
assert.deepEqual(events, [
  "read-config:/repo",
  "fork:parent-thread",
  "inject:side-thread",
  "create-side:side-thread",
  "sync-card:side_entered",
  "start-turn:explain this failure"
]);
```

- [ ] **Step 2: Run the coordinator test and verify RED**

Run:

```bash
node --import tsx --test src/service/side-conversation-coordinator.test.ts
```

Expected: FAIL because the coordinator does not exist.

- [ ] **Step 3: Implement constants, capability check, and public contract**

The module must export:

```ts
export const SIDE_MIN_CODEX_VERSION = [0, 144, 1] as const;
export const SIDE_ALLOWED_COMMANDS = new Set([
  "status", "where", "inspect", "retrieve", "interrupt", "side"
]);

export type SideCallbackAction = "status" | "back" | "interrupt" | "confirm_return" | "cancel_return";

export interface SideConversationCoordinatorDeps {
  getStore(): BridgeStateStore | null;
  ensureAppServerAvailable(): Promise<Pick<CodexAppServerClient,
    "readConfig" | "forkSideThread" | "injectThreadItems" | "unsubscribeThread" | "interruptTurn"
  >>;
  getCodexVersion(): string | null;
  getRunningTurnCapacity(chatId: string): { allowed: boolean; limit: number; running: number };
  getActiveTurn(sessionId: string): { threadId: string; turnId: string } | null;
  startTextTurn(chatId: string, session: SessionRow, text: string): Promise<void>;
  syncCurrentSessionCard(chatId: string, reason: string): Promise<void>;
  surfacePendingInteractions(chatId: string, sessionId: string): Promise<void>;
  expireSideInteractions(chatId: string, sessionId: string): Promise<void>;
  clearSideTransientInput(chatId: string, sessionId: string): void;
  releaseHeldTerminalResults(chatId: string, sessionId: string): Promise<number>;
  getParentStatus(parent: SessionRow): SideParentStatus;
  parentNeedsAction(chatId: string, parentSessionId: string): boolean;
  countHeldResults(parentSessionId: string): number;
  getUiLanguage(): UiLanguage;
  safeSendMessage(chatId: string, text: string, replyMarkup?: TelegramInlineKeyboardMarkup): Promise<boolean>;
  safeSendHtmlMessage(chatId: string, html: string, replyMarkup?: TelegramInlineKeyboardMarkup): Promise<boolean>;
  nowMs(): number;
  createToken(): string;
}

export class SideConversationCoordinator {
  handleCommand(chatId: string, args: string): Promise<void>;
  handleCallback(chatId: string, token: string, action: SideCallbackAction): Promise<string | null>;
  isCommandAllowed(commandName: string): boolean;
  isParentSurfaceHeld(sessionId: string): boolean;
  getCardView(sideSession: SessionRow): SideCardViewModel | null;
}
```

Use exact side safety constants that state inherited history is reference-only, only post-boundary messages are active instructions, subagents are unavailable, and mutations require an explicit post-boundary request. `buildSideDeveloperInstructions(existing)` must preserve non-empty existing instructions before appending the side policy.

Implement semantic version parsing that accepts `codex-cli 0.144.1` and later, rejects older/malformed explicit versions, and permits an unknown version to proceed to protocol probing. Classify JSON-RPC method-not-found/unsupported-parameter failures as a side-only update requirement.

- [ ] **Step 4: Implement serialized creation**

Use a per-chat promise queue so only one lifecycle action mutates a chat at a time. The creation body must:

1. Resolve and validate a regular active parent.
2. Reject an already-active side with a refresh/help message.
3. Check capacity and feature version.
4. Read runtime config including `developer_instructions`.
5. Call `forkSideThread` with effective parent model/effort.
6. Inject the hidden boundary item.
7. Call `store.createSideSession`.
8. Issue a fresh random opaque card token bound to the side session ID.
9. Sync the current-session card.
10. Submit the inline prompt only after the active binding points at side.

Token records must contain `{ chatId, sideSessionId, generation, kind }`; replacing a card token invalidates the older generation.

- [ ] **Step 5: Run creation tests and verify GREEN**

Run the Task 4 test command. Expected: all creation and capability tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/service/side-conversation-coordinator.ts src/service/side-conversation-coordinator.test.ts
git commit -m "feat: create ephemeral side conversations"
```

## Task 5: Implement Safe Return, Confirmation, and Stale Callback Handling

**Files:**
- Modify: `src/service/side-conversation-coordinator.ts`
- Test: `src/service/side-conversation-coordinator.test.ts`

- [ ] **Step 1: Write failing return-state tests**

Cover:

- idle `/side back` unsubscribes, restores parent, deletes side, syncs card, surfaces interactions, releases results
- running `/side back` sends confirmation without interrupting
- cancel confirmation leaves side active
- confirm interrupts the exact side turn before unsubscribe
- side turn completing between confirmation and confirm skips interrupt and still unsubscribes
- interrupt failure leaves side active
- unsubscribe failure leaves side active
- stale/duplicate/wrong-chat tokens return `这个 Side 操作已失效。`
- parent-status callback is read-only
- interrupt callback targets side only
- missing parent chooses regular fallback or `/new`

The successful running return order must be:

```ts
assert.deepEqual(events, [
  "interrupt:side-thread:side-turn",
  "expire-interactions:side-session",
  "clear-transient-input:side-session",
  "unsubscribe:side-thread",
  "restore-parent",
  "sync-card:side_returned",
  "surface-interactions:parent-session",
  "release-results:parent-session"
]);
```

- [ ] **Step 2: Run the coordinator test and verify RED**

Run the Task 4 coordinator command. Expected: new return tests fail.

- [ ] **Step 3: Implement return-confirmation tokens**

Return confirmations use distinct random tokens with:

```ts
interface SideReturnConfirmation {
  chatId: string;
  sideSessionId: string;
  parentSessionId: string;
  expiresAtMs: number;
  consumed: boolean;
}
```

Set expiry to two minutes. Consume the token on the first confirm/cancel/wrong-chat decision. Expired or consumed tokens never call app-server or store mutation methods.

- [ ] **Step 4: Implement close ordering and rollback-on-failure semantics**

For a confirmed close, re-read the active side and active turn under the per-chat queue. Interrupt only when the turn still belongs to that side. Expire actionable side interactions with reason `side_closed`, clear side-owned pending rich input, then unsubscribe. Do not change the active binding until interrupt and unsubscribe succeed. Then restore/delete atomically, invalidate all side tokens, sync the parent card, surface parent interactions, and release held results.

On interrupt/unsubscribe failure, keep the side record and binding untouched, refresh the side card, and return a retryable Chinese/English error.

- [ ] **Step 5: Run coordinator tests and verify GREEN**

Run the coordinator command. Expected: all creation and return tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/service/side-conversation-coordinator.ts src/service/side-conversation-coordinator.test.ts
git commit -m "feat: safely return from side conversations"
```

## Task 6: Wire Side Cards, Message Routing, and Command Gating

**Files:**
- Modify: `src/service/current-session-card-controller.ts`
- Modify: `src/service/current-session-card-controller.test.ts`
- Modify: `src/service.ts`
- Test: `src/service.test.ts`

- [ ] **Step 1: Write failing card-controller tests**

Change the card harness to capture reply markup. Assert a side render is sent/pinned with controls, edited in place for parent-state changes, replaced on edit failure, and replaced by the regular parent card after return.

Introduce this renderer dependency:

```ts
renderSessionCard(session: SessionRow): Promise<{
  html: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}>;
```

Tests must verify `safeSendHtmlMessageResult` and `safeEditHtmlMessageText` receive the side markup unchanged.

- [ ] **Step 2: Write failing service integration tests**

Add service tests for:

- `/side` is intercepted before a parent app-server questionnaire text mode
- pending rename/manual-path/rich-input composer blocks side with `/cancel` guidance
- normal text, voice/media/rich input, and leading `!` route to active side
- `/status`, `/where`, `/inspect`, `/retrieve`, `/interrupt`, `/side back` execute in side
- `/new`, `/use`, `/model`, `/fork`, `/rollback`, `/clear`, `/compact`, `/commands`, and unknown commands are blocked before handlers run
- Feishu `/side` is unsupported and absent from command sync
- a parent status change refreshes the active side card even though parent is not the active session
- callback router delegates side actions and answers with the coordinator result

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
node --import tsx --test src/service/current-session-card-controller.test.ts src/service.test.ts
```

Expected: FAIL on missing side wiring, markup forwarding, early interception, and command gate.

- [ ] **Step 4: Refactor the current-session card controller**

Replace direct model/card formatting with `renderSessionCard`. Pass optional reply markup to both send and edit operations. Preserve existing pin/unpin/replacement behavior and all regular-card output.

In service, render regular sessions with `buildCurrentSessionCardText`; render side sessions by calling `sideConversationCoordinator.getCardView` and `buildSideSessionCardMessage`.

- [ ] **Step 5: Wire coordinator creation after turn/runtime dependencies**

Instantiate `SideConversationCoordinator` after `TurnCoordinator`. Supply narrow delegates for app-server, capacity, start/interrupt turn, card sync, interaction surfacing, terminal release, status snapshot, messages, and Codex version.

Wire `expireSideInteractions` to `interactionBroker.resolveActionablePendingInteractionsForSession` with `{ state: "expired", reason: "side_closed", resolutionSource: "turn_expired" }`. Wire `clearSideTransientInput` to `richInputAdapter.resetPendingTransientState(chatId)` after revalidating the active side session ID.

Add `handleSide` to `routeCommand`. Intercept parsed `/side` immediately after authorization/runtime-notice flush and before pending app-server interaction text mode. The coordinator itself rejects active rename/manual-path/rich-composer modes.

Before routing any other slash command while the active session is side, call `isCommandAllowed`; blocked commands send `Side 模式中不能使用这个命令，请先返回主会话。` Shell, media, and ordinary text retain their current paths because they target `getActiveSession`.

Update `syncCurrentSessionCardForSession`: refresh when the changed session is active, or when the active session is side and its `parentSessionId` equals the changed regular session ID.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the Task 6 command. Expected: all card and service tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/service/current-session-card-controller.ts src/service/current-session-card-controller.test.ts src/service.ts src/service.test.ts
git commit -m "feat: route Telegram input through side mode"
```

## Task 7: Hold Parent Interaction Cards Until Return

**Files:**
- Modify: `src/service/interaction-broker.ts`
- Test: `src/service/interaction-broker.test.ts`
- Modify: `src/service.ts`
- Test: `src/service.test.ts`

- [ ] **Step 1: Write failing broker tests**

Add dependency hooks:

```ts
shouldHoldInteractionSurface(sessionId: string): boolean;
onInteractionSurfaceHeld(sessionId: string): Promise<void>;
```

Test that a parent request under active side:

- persists as actionable
- does not call Telegram send
- does not respond with app-server error
- calls `onInteractionSurfaceHeld(parentSessionId)`
- remains visible to `buildPendingInteractionSummaries(parent)`

Add tests for:

```ts
await broker.surfacePendingInteractionCardsForSession("chat-1", "parent-session");
```

It must send every actionable row with `messageId === null` in creation order, persist each message ID, and remain idempotent on a second call.

- [ ] **Step 2: Run broker tests and verify RED**

Run:

```bash
node --import tsx --test src/service/interaction-broker.test.ts
```

Expected: FAIL because hold hooks and the surfacing method do not exist.

- [ ] **Step 3: Implement interaction holding**

In `handleNormalizedServerRequest`, create/journal the pending row first. When `shouldHoldInteractionSurface(activeTurn.sessionId)` is true, skip `sendPendingInteractionCard`, mark the runtime card for reanchor, call the held hook, and return without resolving the server request.

Implement:

```ts
async surfacePendingInteractionCardsForSession(chatId: string, sessionId: string): Promise<void>;
```

On delivery failure during return, reuse the existing failure transition, journal `interaction_delivery_failed`, and respond to the still-live app-server request with `-32603`.

- [ ] **Step 4: Wire parent/side detection and card refresh**

Service passes `store.getActiveSideForParent(sessionId) !== null` to the hold hook and refreshes the current side card from `onInteractionSurfaceHeld`. The side coordinator calls `surfacePendingInteractionCardsForSession` only after the parent binding is restored.

- [ ] **Step 5: Run broker and service tests and verify GREEN**

Run:

```bash
node --import tsx --test src/service/interaction-broker.test.ts src/service.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/service/interaction-broker.ts src/service/interaction-broker.test.ts src/service.ts src/service.test.ts
git commit -m "feat: defer parent interactions during side mode"
```

## Task 8: Hold and Release Parent Terminal Results

**Files:**
- Modify: `src/service/turn-coordinator.ts`
- Test: `src/service/turn-coordinator.test.ts`
- Modify: `src/service.ts`
- Test: `src/service.test.ts`

- [ ] **Step 1: Write failing terminal-delivery tests**

Add a dependency:

```ts
shouldHoldTerminalOutput(sessionId: string): boolean;
```

Test parent completion under active side:

- persists `final_answer` or `plan_result` as `held_for_side`
- sends neither result nor deferred notice
- updates the parent session status and refreshes the side card
- keeps the pending runtime handoff recoverable

Test side completion sends immediately.

Test release:

```ts
await coordinator.releaseHeldTerminalResults("chat-1", "parent-session");
```

It must claim held rows in creation order, dispatch each through the existing Telegram terminal surface, set successful rows `visible`, create the existing deferred notice on Telegram failure, and complete the pending runtime handoff. A second call sends nothing.

Add a race test that runs parent completion and return release concurrently and asserts one result send.

- [ ] **Step 2: Run turn tests and verify RED**

Run:

```bash
node --import tsx --test src/service/turn-coordinator.test.ts
```

Expected: FAIL on missing hold policy and release API.

- [ ] **Step 3: Refactor persisted terminal dispatch**

Extract the common direct/deferred send path from `sendFinalAnswer` and `sendPlanResult` into:

```ts
private async deliverPersistedTerminalResult(
  saved: TerminalResultViewRow,
  activeTurn?: ActiveTurnState
): Promise<TerminalDeliveryResult>;

async releaseHeldTerminalResults(chatId: string, sessionId: string): Promise<number>;
```

When hold policy is true, render and save with `deliveryState: "held_for_side"`, return a non-visible delivery result, and do not send a deferred notice. Normal completion must remain byte-for-byte equivalent at the Telegram surface.

For a failed parent turn under side, save the existing safe failure text as a held final-answer view instead of sending it into side chat. Interrupted parent turns update the side card but keep the existing no-message behavior.

- [ ] **Step 4: Wire the hold policy and release delegate**

Service returns `store.getActiveSideForParent(sessionId) !== null` from the hold hook. The side coordinator's release delegate calls `turnCoordinator.releaseHeldTerminalResults` after restoring the parent card.

- [ ] **Step 5: Run turn and service tests and verify GREEN**

Run:

```bash
node --import tsx --test src/service/turn-coordinator.test.ts src/service.test.ts
```

Expected: all selected tests pass, including the existing max/ultra propagation tests.

- [ ] **Step 6: Commit**

```bash
git add src/service/turn-coordinator.ts src/service/turn-coordinator.test.ts src/service.ts src/service.test.ts
git commit -m "feat: hold parent results during side mode"
```

## Task 9: Add Restart Recovery, Documentation, and End-to-End Verification

**Files:**
- Modify: `src/service.ts`
- Test: `src/service.test.ts`
- Modify: `docs/product/codex-command-reference.md`
- Modify: `docs/product/chat-and-project-flow.md`
- Modify: `docs/product/callback-contract.md`
- Modify: `docs/architecture/codex-app-server-adoption.md`

- [ ] **Step 1: Write failing startup recovery tests**

Seed a parent, active side, held terminal result, and pending parent interaction. Restart the service harness and assert:

- `recoverSideSessionsAfterRestart` runs before generic running-session recovery
- side row is removed
- parent or regular fallback is active
- regular current-session card is restored
- exactly one `Side 已因服务重启关闭。` notice is delivered
- held result is released once
- pre-restart parent interaction follows existing bridge-restart failure recovery and no actionable stale card is sent
- a second restart emits no side notice and no duplicate result

- [ ] **Step 2: Run service tests and verify RED**

Run:

```bash
node --import tsx --test src/service.test.ts
```

Expected: new recovery tests fail because startup does not yet recover side rows or release held results.

- [ ] **Step 3: Implement startup ordering**

In `run()`:

1. Open the store.
2. Call `recoverSideSessionsAfterRestart()` and keep the returned parent IDs.
3. Run existing running-session and interaction recovery on the now side-free store.
4. Initialize readiness, app-server, API, and poller.
5. Restore regular current-session cards.
6. Flush restart notices.
7. Release held results for recovered parents.
8. Continue existing runtime-hub recovery and polling.

Do not attempt to unsubscribe pre-restart ephemeral thread IDs because the old app-server process is gone.

- [ ] **Step 4: Update current-truth docs**

Document:

- `/side [question]` and `/side back`
- persistent side card and command allowlist
- running-side return confirmation
- parent approval/result holding
- ephemeral restart behavior and non-resumability
- callback family `v11:sd:*`
- adopted app-server methods `thread/fork(ephemeral)`, `thread/inject_items`, and `thread/unsubscribe`
- Telegram-only scope and no `/btw` alias

- [ ] **Step 5: Run focused and full automated verification**

Run:

```bash
npm run check
node --import tsx --test src/codex/app-server.test.ts src/state/store.test.ts src/telegram/ui.test.ts src/telegram/commands.test.ts src/service/command-router.test.ts src/service/callback-router.test.ts src/service/current-session-card-controller.test.ts src/service/side-conversation-coordinator.test.ts src/service/interaction-broker.test.ts src/service/turn-coordinator.test.ts src/service.test.ts
npm test
npm run build
npm audit --package-lock-only
git diff --check master..HEAD
```

Expected: every command exits 0; the full suite reports 0 failures; audit reports 0 vulnerabilities; diff check emits no output.

- [ ] **Step 6: Commit recovery and docs**

```bash
git add src/service.ts src/service.test.ts docs/product/codex-command-reference.md docs/product/chat-and-project-flow.md docs/product/callback-contract.md docs/architecture/codex-app-server-adoption.md
git commit -m "feat: recover Telegram side conversations safely"
```

- [ ] **Step 7: Perform Telegram smoke verification after installation**

Install with the verified Codex binary, then exercise this exact sequence in the authorized Telegram chat:

1. Start a long-running parent task.
2. Send `/side explain the current approach` and verify the pinned card identifies side while parent remains running.
3. Ask a second side question and run `!pwd`; verify both target side.
4. Let the parent finish and verify no parent final answer appears in side chat; the card changes to `返回查看结果`.
5. Send `/side back`; verify the parent card returns and its final answer appears once.
6. Start another parent that requests approval; enter side; verify only `返回并处理审批` appears, then return and handle the real card.
7. Start a running side turn, press return, cancel once, then confirm; verify the first cancel preserves side and the second path interrupts and returns.
8. Enter side, restart the service, and verify the parent is restored with one restart notice and no resumable side entry.

Record the installed commit, service status, live Codex child path/version, and smoke outcomes in the final handoff.
