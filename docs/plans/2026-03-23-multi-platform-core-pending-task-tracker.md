# Multi-Platform Core Pending Task Tracker

> Truth status:
> - Current truth? No
> - Use for: active backlog lock for deferred multi-platform Core work outside phase 1
> - Verify current shipped behavior in: `docs/product/`, `docs/architecture/`, and current `src/`

Planning tracker with verified current status as of 2026-03-23.
This file is not a current-behavior spec.
It exists to keep deferred work visible while phase 1 stays intentionally narrow.

## Purpose

Phase 1 is only the first Core seam.
Without an explicit tracker, the repo is likely to blur "Core started" into "multi-platform solved".

This document prevents that drift by locking every major deferred item in one place.

## Locked Phase-1 Boundary

Phase 1 intentionally does not include:

- SQLite schema neutralization
- capability-layer extraction
- presentation-layer extraction
- Telegram Pack formalization
- second platform delivery
- Web or App console delivery
- install/admin pack-aware setup
- broad long-tail decoupling of every Telegram command path
- automatic merge back into `main` or `master`

Use this tracker whenever a future task is tempted to say "we can do that later."

## Activation Order

Recommended order after phase 1:

1. persistence neutralization
2. capability layer
3. presentation layer
4. Telegram Pack formalization
5. install/admin pack support
6. second platform pilot
7. Web/App console
8. long-tail flow decoupling

This order can change only if a later approved plan explains why.

## Pending Items

### MP-01: Neutralize persistence and delivery identifiers

Status:
- deferred until phase 1 is stable

Why deferred now:
- schema churn is the highest-risk refactor in this direction
- phase 1 can prove the Core boundary without making persistence migration part of the first review

Activation trigger:
- workflow and interaction-model seams are already landed and green
- Telegram behavior remains stable after phase 1

Done definition:
- bridge-owned records stop using Telegram-specific ids as their primary business identity
- transport-specific ids move to delivery-reference fields or transport-scoped records
- restart recovery and final-answer callback recovery still work after migration
- schema migration and reopen tests exist

Likely affected areas:
- `src/types.ts`
- `src/state/store.ts`
- `src/state/store-runtime-artifacts.ts`
- `src/state/store-pending-interactions.ts`
- `docs/architecture/runtime-and-state.md`

### MP-02: Add a real capability layer

Status:
- deferred until at least one non-Telegram rendering path is being prepared

Why deferred now:
- capability work is too speculative while only one renderer exists
- phase 1 should establish semantic interaction intent first

Activation trigger:
- phase 1 interaction model is stable
- a second renderer, second pack, or meaningful fallback matrix is under design

Done definition:
- the bridge can declare platform abilities such as buttons, edits, uploads, previews, and long-form pagination explicitly
- fallback behavior is selected by capability policy rather than scattered platform checks

Likely affected areas:
- future Core capability modules
- workflow decision points
- Telegram rendering fallbacks
- future Slack/Discord/Web design docs

### MP-03: Extract a presentation layer

Status:
- deferred until after the capability layer begins to exist

Why deferred now:
- separating renderers before semantic interaction inputs are stable would create a rename-only split

Activation trigger:
- interaction model is stable
- capability rules exist for at least the major runtime and final-answer surfaces

Done definition:
- Telegram rendering consumes only interaction-model inputs and capability context
- business decisions no longer live inside Telegram UI builders
- final-answer, runtime, picker, and recovery rendering boundaries are explicit

Likely affected areas:
- `src/telegram/ui-runtime.ts`
- `src/telegram/ui-final-answer.ts`
- `src/telegram/ui-messages.ts`
- `src/service/runtime-surface-controller.ts`

### MP-04: Formalize Telegram as the first official platform pack

Status:
- deferred until Core, capability, and presentation seams are real

Why deferred now:
- Telegram is still mixed across transport, auth, callback, rendering, and install behavior
- extracting a pack before those seams exist would mostly move the same coupling into a new folder

Activation trigger:
- Core interaction and workflow boundaries are stable
- Telegram rendering and transport responsibilities are easier to isolate

Done definition:
- Telegram transport, auth, ingress, egress, and callback compatibility have an explicit pack boundary
- Core no longer imports Telegram concerns outside the agreed adapter edge
- Telegram remains the reference pack, not the hidden default architecture

Likely affected areas:
- `src/service.ts`
- `src/telegram/`
- `src/install.ts`
- Telegram-related docs and skills

### MP-05: Add pack-aware install and admin support

Status:
- deferred until Telegram Pack formalization starts

Why deferred now:
- current install/admin path is intentionally Telegram-first and already large
- expanding it before pack boundaries exist would enlarge the wrong surface

Activation trigger:
- Telegram pack boundary is explicit
- at least one more pack is likely enough to justify shared install/admin logic

Done definition:
- install flow can select or validate pack configuration intentionally
- doctor/status/update can explain pack-specific readiness cleanly
- pack-specific credentials and setup steps are no longer hard-coded as Telegram-only assumptions

Likely affected areas:
- `src/install.ts`
- `src/cli.ts`
- `src/config.ts`
- `docs/operations/install-and-admin.md`
- bundled setup skills

### MP-06: Deliver one second-platform pilot

Status:
- deferred until the Core and Telegram Pack seams are credible

Why deferred now:
- adding a second platform before the internal seam holds would only duplicate Telegram coupling

Activation trigger:
- phase 1 is complete
- capability and presentation rules are stable enough to absorb a second renderer
- Telegram Pack is explicit enough to compare against

Done definition:
- one additional platform can start or resume sessions, run turns, handle blocked interactions, show runtime state, and deliver final answers using the shared Core
- platform-specific code stays inside pack and presentation boundaries

Likely affected areas:
- future platform pack directory
- workflow adapters
- capability policies
- install/admin docs and skills

### MP-07: Add a Web or App control console

Status:
- deferred until after a second platform proves the Core abstraction

Why deferred now:
- Web/App work is a larger product surface and should consume the Core, not drive it prematurely

Activation trigger:
- at least one non-Telegram path has already validated the interaction model
- runtime and final-answer semantics are stable outside Telegram chat assumptions

Done definition:
- Web/App console reuses workflow and interaction-model contracts
- it does not bypass bridge logic with a direct app-server-only shortcut
- session, runtime, interaction, and final-answer semantics remain aligned with the shared Core

Likely affected areas:
- future console package
- future presentation modules
- capability rules
- product docs and install docs

### MP-08: Decouple long-tail Telegram-owned flows

Status:
- deferred until the main Core seam is landed

Why deferred now:
- not every flow needs to move in phase 1
- broad cleanup before the main seam is stable would create churn without a clear payoff

Activation trigger:
- after phase 1, when hotspots are easier to rank by real coupling rather than guesswork

Done definition:
- session/project flow, project browser, rich input, media adaptation, and long-tail command paths each have an explicit answer to whether they are Domain, Workflow, Interaction Model, Capability, Presentation, or Pack
- no major bridge-owned flow stays Telegram-first merely because it was "left for later"

Likely affected areas:
- `src/service/session-project-coordinator.ts`
- `src/service/project-browser-coordinator.ts`
- `src/service/rich-input-adapter.ts`
- `src/service/codex-command-coordinator.ts`
- relevant Telegram UI modules

## Review Gate Before Starting The Next Wave

Before activating any item above, confirm all of the following:

- the phase-1 worktree branch is verified and reviewed
- the deferred item still belongs after phase 1 and was not accidentally solved already
- the item has a narrower plan than "generalize more things"
- current docs and AGENTS routing still separate shipped Telegram truth from future Core direction

## Final Rule

If a future task touches multi-platform direction and is not clearly phase 1, it should either:

- point to one tracker item above
- or add a new tracker item before the work starts

Do not let deferred architecture work disappear into ad hoc refactors.
