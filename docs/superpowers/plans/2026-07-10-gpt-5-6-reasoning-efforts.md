# GPT-5.6 Reasoning Efforts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support Codex reasoning-effort values `max` and `ultra` throughout Telegram rendering, callbacks, persistence, and turn submission.

**Architecture:** Extend the shared closed effort type and every explicit formatter/parser boundary. Drive the change from UI and service integration tests so unsupported future callback values remain rejected while runtime formatting has a safe raw-value fallback.

**Tech Stack:** TypeScript, Node test runner, Codex app-server model/turn RPC, Telegram inline callbacks, SQLite session persistence.

---

### Task 1: Type, labels, and callback round-trip

**Files:**
- Modify: `src/types.ts`
- Modify: `src/telegram/ui-shared.ts`
- Modify: `src/telegram/ui-messages.ts`
- Modify: `src/telegram/ui-callbacks.ts`
- Modify: `src/telegram/ui.test.ts`

- [ ] **Step 1: Write failing label and picker tests**

Add assertions that `formatReasoningEffortLabel("max")` returns `Max`, `formatReasoningEffortLabel("ultra")` returns `Ultra`, and a GPT-5.6 reasoning picker containing both values has those button labels and no `undefined` text.

```ts
const picker = buildReasoningEffortPickerMessage({
  session: createSession(),
  model: {
    id: "gpt-5.6-sol",
    displayName: "GPT-5.6-Sol",
    isDefault: true,
    defaultReasoningEffort: "low",
    supportedReasoningEfforts: [
      { reasoningEffort: "max", description: "Maximum reasoning depth" },
      { reasoningEffort: "ultra", description: "Automatic delegation" }
    ]
  },
  modelIndex: 0
});
const labels = picker.replyMarkup.inline_keyboard.flat().map((button) => button.text);
assert.ok(labels.includes("Max"));
assert.ok(labels.includes("Ultra"));
assert.doesNotMatch(labels.join("\n"), /undefined/u);
```

- [ ] **Step 2: Write failing callback tests**

```ts
for (const effort of ["max", "ultra"] as const) {
  const callback = encodeModelEffortCallback("session-1", 0, effort);
  assert.deepEqual(parseCallbackData(callback), {
    kind: "model_effort",
    sessionId: "session-1",
    modelIndex: 0,
    effort
  });
}
assert.equal(parseCallbackData("v1:model:effort:session-1:0:future"), null);
```

- [ ] **Step 3: Run tests and verify RED**

```bash
node --import tsx --test --test-name-pattern="max|ultra|GPT-5.6" src/telegram/ui.test.ts
```

Expected: type errors or assertions showing undefined labels and rejected callbacks.

- [ ] **Step 4: Implement the shared compatibility changes**

Extend the union:

```ts
export type ReasoningEffort =
  | "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
```

Add `max` and `ultra` cases returning `Max` and `Ultra` to the Chinese/shared and English card formatters. Add a defensive default branch returning the raw value. Add both explicit values to `parseReasoningEffort`; leave other unknown strings rejected.

- [ ] **Step 5: Verify GREEN and commit**

```bash
node --import tsx --test src/telegram/ui.test.ts
npm run check
git add src/types.ts src/telegram/ui-shared.ts src/telegram/ui-messages.ts src/telegram/ui-callbacks.ts src/telegram/ui.test.ts
git commit -m "feat: support GPT-5.6 reasoning efforts"
```

### Task 2: Persistence, turn submission, review, and deployment

**Files:**
- Modify: `src/service.test.ts`
- Modify: `src/service/turn-coordinator.test.ts`
- Modify only if a failing test requires it: `src/service/codex-command-coordinator.ts`, `src/service/turn-coordinator.ts`, `src/state/store-sessions.ts`

- [ ] **Step 1: Write failing service selection tests**

Model the GPT-5.6 response with `max` and `ultra`, invoke each effort callback, and assert the selected effort is persisted unchanged and the callback succeeds.

```ts
assert.equal(store.getActiveSession("1")?.selectedReasoningEffort, "ultra");
```

- [ ] **Step 2: Write failing turn-submission tests**

Create a session with `selectedReasoningEffort: "max"`, start a turn, and assert the app-server input preserves it:

```ts
assert.equal(startTurnCalls.at(-1)?.effort, "max");
```

Repeat the collaboration-mode path with `ultra` and assert its settings contain `reasoningEffort: "ultra"`.

- [ ] **Step 3: Run tests and verify RED**

```bash
node --import tsx --test --test-name-pattern="max|ultra|GPT-5.6" src/service.test.ts src/service/turn-coordinator.test.ts
```

Expected: failures at any remaining persistence or turn boundary that still rejects the new union values.

- [ ] **Step 4: Implement only boundary fixes exposed by RED**

Preserve `max` and `ultra` exactly through session storage, callback handling, `turn/start.effort`, and collaboration-mode settings. Do not add model-ID checks or schema changes; the existing SQLite column is nullable text.

- [ ] **Step 5: Run focused and full verification**

```bash
node --import tsx --test src/telegram/ui.test.ts src/service.test.ts src/service/turn-coordinator.test.ts
git diff --check
npm audit --package-lock-only
npm run check
npm test
npm run build
```

Expected: focused/full tests pass, audit reports zero vulnerabilities, and typecheck/build succeed.

- [ ] **Step 6: Commit integration tests or fixes**

```bash
git add src/service.test.ts src/service/turn-coordinator.test.ts src/service/codex-command-coordinator.ts src/service/turn-coordinator.ts src/state/store-sessions.ts
git commit -m "test: verify GPT-5.6 effort propagation"
```

Stage only files that actually changed.

- [ ] **Step 7: Request final review, install, and push**

Use `requesting-code-review`; fix Critical/Important findings with failing tests. Re-run Step 5, then:

```bash
node dist/cli.js install --codex-bin /home/jingw/.local/npm-global/bin/codex
~/.local/share/codex-telegram-bridge/bin/ctb doctor
git push origin feat/telegram-retrieve-file
```

- [ ] **Step 8: Telegram smoke test**

Send `/model`, choose GPT-5.6-Sol, and verify `Max` and `Ultra` buttons render. Select each once and verify the session card reports the selected value without `undefined`.
