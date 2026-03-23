# Multi-Platform Core Phase 1 Implementation Plan

> Truth status:
> - Current truth? No
> - Use for: implementation sequencing for the first internal multi-platform Core abstraction wave
> - Verify current shipped behavior in: `docs/product/`, `docs/architecture/`, and current `src/`

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Planning document with verified current status as of 2026-03-23.
This file is not a current-behavior spec.
It is the approved first implementation plan for the multi-platform Core transition.

## Goal

Land the first internal platform-neutral seam without changing the shipped Telegram product surface.

Phase 1 only establishes three layers:

- Domain
- Workflow
- Interaction Model

This phase is intentionally narrower than the full future architecture described in `docs/future/multi-platform-core-prd.md`.
It is the minimum useful step that makes later Capability, Presentation, Pack, and second-platform work materially easier instead of more speculative.

## Verified Starting Point

Current repository truth on 2026-03-23:

- Telegram is still the only shipped control surface.
- The Codex app-server wrapper already reaches beyond the Telegram UX.
- Runtime, delivery, and persistence are still strongly keyed to Telegram identifiers and Telegram rendering assumptions.
- The main current coupling hotspots are `src/service.ts`, `src/service/interaction-broker.ts`, `src/service/runtime-surface-controller.ts`, `src/service/turn-coordinator.ts`, `src/types.ts`, `src/state/store-runtime-artifacts.ts`, and `src/state/store-pending-interactions.ts`.
- Install/admin flow, SQLite schema, and Telegram callback behavior are already broad enough that they should not be generalized in the first wave unless strictly necessary.

Practical implication:

- the repo is ready for an internal Core seam
- it is not ready for an immediate full platform-pack split

## Scope Lock

Phase 1 is in scope for:

- introducing platform-neutral Core terminology for bridge-owned business objects
- separating session, turn, interaction, and recovery flow ownership from Telegram rendering details
- defining a platform-neutral interaction model for the current bridge surfaces
- adapting the Telegram path to consume the new Core seam while preserving current behavior
- keeping current docs and AGENTS routing aligned with the selected sequence

Phase 1 is out of scope for:

- SQLite schema migration or Telegram-field removal
- capability-layer extraction
- presentation-layer extraction
- Telegram Pack formalization
- second platform delivery
- Web or App console delivery
- install/admin pack selection
- repository/package/CLI rename

## Worktree Execution Rules

All implementation for this phase must follow these constraints:

- work inside `.worktrees/multi-platform-core-phase-1`
- use branch `feat/multi-platform-core-phase-1`
- do not merge, cherry-pick, or otherwise fold the branch back into `main` or `master` when implementation finishes
- wait for explicit human instruction before any merge or final integration step

This rule exists to keep the current Telegram product stable while the Core boundary is still being reviewed.

## Architecture Intent

Phase 1 should create the following internal shape:

### Domain

Bridge-owned records and concepts such as:

- bridge session
- turn
- pending interaction
- runtime notice
- final-answer view
- project selection context

Rule:
- these objects must describe bridge business meaning first, not Telegram delivery structure first

### Workflow

Bridge-owned orchestration for:

- start or resume session
- start turn
- continue blocked turn
- expire or resolve pending interactions
- reduce runtime state
- finalize delivery and recovery

Rule:
- workflow decides what must happen
- Telegram code decides only how that result is shown or transported

### Interaction Model

Platform-neutral interaction semantics for:

- picker
- approval
- questionnaire
- paginated view
- runtime panel
- final-answer preview and expand flow
- recovery notice

Rule:
- workflow emits interaction intent in semantic form
- Telegram adapts that semantic form into chat messages, buttons, and callbacks

## Phase 1 Success Criteria

Phase 1 is successful when:

- core flow can ask for interaction by semantic type instead of building Telegram UI objects directly
- workflow logic no longer depends on `TelegramInlineKeyboardMarkup` or Telegram message ids as its primary control surface
- Telegram remains the visible UX, but becomes a consumer of Core interaction intent rather than the source of product semantics
- current user-facing Telegram behavior stays materially unchanged
- `npm run check` and `npm test` remain green after the refactor

## Task Plan

### Task 1: Establish neutral phase-1 ownership and naming

**Files:**

- Add: `src/core/domain/` or equivalent narrow Core domain modules
- Add: `src/core/workflow/` or equivalent narrow workflow modules
- Add: `src/core/interaction-model/` or equivalent narrow interaction-model modules
- Modify: `src/types.ts`
- Modify: `docs/architecture/current-code-organization.md` after implementation lands

**Step 1: Write the failing contract tests**

Add focused tests that lock the intended Core seam:

- workflow-facing types no longer require Telegram UI types
- semantic interaction records exist for current picker, approval, questionnaire, runtime, and final-answer cases
- neutral domain records preserve the current bridge meaning already exercised by the Telegram path

**Step 2: Run targeted tests to verify they fail**

Run:

- `npm test -- src/service.test.ts`
- `npm test -- src/telegram/ui.test.ts`

Expected:
- FAIL because the new neutral contracts do not exist yet

**Step 3: Add the minimum phase-1 modules and neutral terminology**

Implement only enough structure to make the new tests reachable:

- neutral Core terms for bridge-owned records
- neutral workflow request and result types
- semantic interaction-model records

**Step 4: Re-run targeted tests**

Run:

- `npm test -- src/service.test.ts`
- `npm test -- src/telegram/ui.test.ts`

Expected:
- PASS

### Task 2: Move session, turn, and interaction decisions behind workflow ownership

**Files:**

- Modify: `src/service/session-project-coordinator.ts`
- Modify: `src/service/turn-coordinator.ts`
- Modify: `src/service/interaction-broker.ts`
- Modify: `src/service/runtime-surface-controller.ts`
- Modify: new workflow modules from Task 1

**Step 1: Add failing coordinator-level tests**

Add focused tests proving that:

- workflow can decide session/turn/interaction state transitions without constructing Telegram payloads directly
- blocked-turn continuation and interaction resolution stay workflow-owned
- runtime and recovery decisions remain bridge-owned even when Telegram is still the only renderer

**Step 2: Run targeted tests to verify they fail**

Run:

- `npm test -- src/service/turn-coordinator.test.ts`
- `npm test -- src/service/runtime-surface-controller.test.ts`
- `npm test -- src/service/codex-command-coordinator.test.ts`

Expected:
- FAIL because those decisions still depend on Telegram-owned structures or direct Telegram assumptions

**Step 3: Refactor behind the workflow seam**

Move bridge decisions into workflow ownership while keeping current Telegram results unchanged:

- session and turn lifecycle decisions
- interaction lifecycle decisions
- runtime reduction and recovery decisions

Rule:
- do not change the store schema in this task
- do not change the command surface in this task

**Step 4: Re-run targeted tests**

Run:

- `npm test -- src/service/turn-coordinator.test.ts`
- `npm test -- src/service/runtime-surface-controller.test.ts`
- `npm test -- src/service/codex-command-coordinator.test.ts`

Expected:
- PASS

### Task 3: Introduce the interaction-model adapter boundary for Telegram

**Files:**

- Modify: `src/telegram/ui-runtime.ts`
- Modify: `src/telegram/ui-final-answer.ts`
- Modify: `src/telegram/ui-messages.ts`
- Modify: `src/service/runtime-surface-controller.ts`
- Modify: `src/service/interaction-broker.ts`
- Modify: new interaction-model modules from Task 1

**Step 1: Add failing renderer and callback tests**

Add focused coverage showing that:

- Telegram renderers receive semantic interaction input instead of raw bridge workflow decisions
- current callback families still map back into the same business actions
- final-answer preview, expansion, and recovery rendering still behave the same after the adapter boundary is introduced

**Step 2: Run targeted tests to verify they fail**

Run:

- `npm test -- src/telegram/ui.test.ts`
- `npm test -- src/service/runtime-surface-controller.test.ts`

Expected:
- FAIL because Telegram rendering still owns too much product semantics directly

**Step 3: Implement the Telegram adapter boundary**

Refactor so Telegram becomes the renderer for semantic interaction-model outputs:

- Telegram builders consume interaction-model records
- Telegram callback decoding still maps to the same business intents
- visible button copy and callback compatibility remain stable unless a deliberate migration is approved later

**Step 4: Re-run targeted tests**

Run:

- `npm test -- src/telegram/ui.test.ts`
- `npm test -- src/service/runtime-surface-controller.test.ts`

Expected:
- PASS

### Task 4: Rewire the bridge shell without changing persistence shape

**Files:**

- Modify: `src/service.ts`
- Modify: `src/types.ts`
- Modify: `src/state/store-runtime-artifacts.ts`
- Modify: `src/state/store-pending-interactions.ts`
- Modify: any narrow bridge modules needed to keep type flow coherent

**Step 1: Add failing integration tests**

Add focused integration coverage for:

- active session flow
- blocked interaction flow
- final-answer persistence and callback recovery flow
- bridge restart and runtime-notice flow

The tests should prove that the bridge can now route through the new Core seam while still persisting the same Telegram-bound identifiers.

**Step 2: Run targeted tests to verify they fail**

Run:

- `npm test -- src/service.test.ts`
- `npm test -- src/state/store.test.ts`

Expected:
- FAIL because the shell and persistence edge still assume Telegram-first flow throughout

**Step 3: Rewire to the new seam**

Implement the minimal integration needed so:

- workflow and interaction-model records become the internal handoff contract
- Telegram-specific ids stay at the delivery boundary
- SQLite schema remains unchanged

**Step 4: Re-run targeted tests**

Run:

- `npm test -- src/service.test.ts`
- `npm test -- src/state/store.test.ts`

Expected:
- PASS

### Task 5: Verify the full phase and hold the branch for review

**Files:**

- Modify: any docs that must reflect landed ownership

**Step 1: Run full verification**

Run:

- `git diff --check`
- `npm run check`
- `npm test`

Expected:
- PASS

**Step 2: Confirm scope lock before closeout**

Verify that the implementation did not silently include:

- schema migration
- second platform
- presentation-layer extraction
- installer redesign

**Step 3: Keep the work in the worktree**

After verification:

- keep branch `feat/multi-platform-core-phase-1` in the dedicated worktree
- do not merge back to the main workspace
- wait for explicit review and integration instruction

## Risks To Watch

The highest phase-1 risks are:

- pseudo-abstraction that only renames Telegram concepts without moving ownership
- workflow still importing Telegram UI types through convenience shortcuts
- renderer split that happens before workflow semantics are stable
- accidental schema work that makes phase 1 larger and harder to review

If any of these appear, narrow the batch again rather than broadening the phase.

## Exit Rule

Do not call phase 1 complete merely because new folders exist.
Call it complete only when Telegram remains the shipped surface, but the internal bridge flow can already distinguish:

- what the bridge means
- what the bridge decides
- how Telegram renders it
