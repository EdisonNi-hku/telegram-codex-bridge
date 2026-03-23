<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: historical plan and landed outcome for the first internal multi-platform Core abstraction wave
read_when:
  - the request is about what Phase 1 landed on 2026-03-23
  - the request needs the historical scope lock for the first Core abstraction wave
skip_when:
  - the request is only about current shipped behavior or future direction beyond Phase 1
source_of_truth:
  - docs/plans/2026-03-23-multi-platform-core-phase-1-implementation-plan.md
  - docs/architecture/current-code-organization.md
  - src/core
-->

# Multi-Platform Core Phase 1 Implementation Plan

Status: Implemented and merged to `master` on 2026-03-23
Merged commit: `02a3774` (`feat: complete phase-1 core seam tightening`)

This file is historical implementation context.
It explains what the first abstraction wave was supposed to do, what it actually landed, and why it stayed narrow.
It is not the current behavior spec.

## Goal

Land the first internal platform-neutral seam without changing the shipped Telegram product surface.

Phase 1 deliberately stopped at three internal layers:

- Domain
- Workflow
- Interaction Model

That was the smallest useful cut that made later capability, presentation, pack, and second-platform work less speculative.

## What Landed

Phase 1 established the first real seam under `src/core/`:

- bridge-owned domain terms and persisted-record contracts
- workflow helpers for interaction, runtime, and terminal delivery semantics
- interaction-model contracts that let Telegram consume semantic views instead of inventing bridge meaning inline

In practice that means:

- `src/core/` now owns the first reusable semantics
- `src/service/` adapts current runtime and persistence into those semantics
- `src/telegram/ui-*.ts` renders Telegram presentation on top of them

## What Phase 1 Explicitly Did Not Do

Phase 1 did not include:

- SQLite schema migration or Telegram-field removal
- capability-layer extraction
- presentation-layer extraction
- Telegram Pack formalization
- second platform delivery
- Web or App console delivery
- install or admin pack selection
- repository or CLI rename

Those items moved into `2026-03-23-multi-platform-core-pending-task-tracker.md`.

## Verified Starting Point At Approval Time

When this plan was approved, the repo already showed the right pressure points:

- Telegram was still the only shipped control surface
- the app-server wrapper already exposed more than the Telegram UX
- runtime, delivery, and persistence were still keyed to Telegram identifiers and rendering assumptions
- install, admin, and SQLite were broad enough that generalizing them in the first wave would create review drag instead of clarity

That is why Phase 1 targeted internal semantics first and left persistence and pack work for later.

## Historical Scope Lock

In scope:

- platform-neutral Core terminology for bridge-owned records
- workflow ownership for session, turn, interaction, runtime, and recovery decisions
- a platform-neutral interaction model for the current bridge surfaces
- adapting Telegram to consume that seam without visible product churn

Out of scope:

- schema neutralization
- capability and presentation extraction
- Telegram Pack formalization
- second-platform delivery
- Web or App console work
- installer redesign

## Historical Task Summary

### Task 1: Establish neutral ownership and contracts

Outcome:

- created the first `src/core/domain/`, `src/core/interaction-model/`, and `src/core/workflow/` modules
- introduced neutral types and semantic interaction records
- proved the seam with focused tests before wiring broader callers

### Task 2: Move bridge decisions behind workflow ownership

Outcome:

- session, turn, interaction, runtime, and recovery decisions stopped depending on Telegram UI types as the primary control surface
- the bridge shell kept current behavior while more of the meaning moved behind workflow helpers

### Task 3: Introduce the Telegram adapter boundary

Outcome:

- Telegram renderers shifted toward consuming semantic interaction inputs
- callback compatibility stayed stable while the business meaning moved out of Telegram builders

### Task 4: Rewire the shell without changing persistence shape

Outcome:

- the bridge routed through the new seam while keeping the existing SQLite schema
- Telegram-specific identifiers stayed at the delivery boundary instead of forcing a schema migration into Phase 1

### Task 5: Verify and close out

Outcome:

- the wave passed the normal verification path
- the work merged on 2026-03-23
- current docs now describe the landed seam instead of treating it as only planned

## Why The Plan Stayed Narrow

The plan was trying to avoid four failure modes:

- fake abstraction that only renamed Telegram concepts
- workflow code still importing Telegram UI types through convenience shortcuts
- presentation splitting before semantic contracts were stable
- accidental schema work turning a boundary refactor into a migration project

The narrow cut was the point, not a compromise.

## Exit Rule

Phase 1 counted as complete only when Telegram was still the shipped surface, but the internal bridge flow could already distinguish:

- what the bridge means
- what the bridge decides
- how Telegram renders it
