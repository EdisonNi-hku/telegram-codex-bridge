<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: active backlog for deferred multi-platform Core work after the first abstraction wave landed
read_when:
  - the request is about what Phase 1 intentionally left for later
  - the request needs the next-wave backlog for multi-platform Core work
skip_when:
  - the request is only about what Phase 1 already landed or about current shipped behavior
source_of_truth:
  - docs/plans/2026-03-23-multi-platform-core-pending-task-tracker.md
  - docs/future/multi-platform-core-prd.md
  - docs/architecture/current-code-organization.md
-->

# Multi-Platform Core Pending Task Tracker

Status: Historical post-Phase-1 backlog baseline
Phase 1 merged to `master` on 2026-03-23 in commit `02a3774`

Use this file to keep "Core started" from turning into the bullshit claim that "multi-platform is solved."
This file records what Phase 1 intentionally deferred at closeout time.
It is no longer the current-truth status page for decoupling progress.

For current implementation status, use:

- `docs/architecture/platform-decoupling-status.md`
- `docs/architecture/platform-pack-boundary.md`
- `docs/architecture/current-code-organization.md`
- `docs/plans/2026-04-08-multi-platform-core-and-feishu-implementation-plan.md`

## Current Starting Point

At the end of Phase 1, the repo had:

- `src/core/domain/`
- `src/core/interaction-model/`
- `src/core/workflow/`
- the first shipped `MP-01` slices for persistence neutralization:
  - bridge-owned runtime and pending-interaction records now expose neutral chat/message naming in code
  - SQLite schema `v17` adds neutral runtime and pending columns with backfill migration coverage
  - auth/session rows now expose neutral aliases in types and store APIs
  - SQLite schema `v18` adds neutral binding columns for authorized user, pending authorization, chat binding, and session ownership

At that handoff point, the repo did not yet have:

- a capability layer
- a presentation layer split
- a Telegram Pack boundary
- pack-aware install and admin support
- a second platform
- a Web or App console

## Activation Order

Recommended order after Phase 1:

1. persistence neutralization
2. capability layer
3. presentation layer
4. Telegram Pack formalization
5. pack-aware install and admin support
6. second-platform pilot
7. Web or App console
8. long-tail Telegram flow decoupling

Change that order only with a narrower approved plan.

Some of those deferred items have materially landed since this tracker was written.
Read the remaining sections as the original deferred buckets from 2026-03-23, not as current implementation truth.

## Original Pending Items At Phase-1 Closeout

### MP-01: Neutralize persistence and delivery identifiers

Status:
- in progress
- materially landed for runtime notice, final answer, current session card, and pending interaction persistence
- materially landed for auth/session schema neutralization and neutral store APIs
- a separate platform binding boundary design now exists so later capability and pack work do not reuse Telegram-first auth language by accident
- a shared platform binding helper now resolves neutral vs compatibility binding fields and is used by auth/session persistence plus critical session/chat identity checks
- session, pending-interaction, and runtime-artifact facade inputs now default to neutral `chatId` and neutral message-id naming instead of Telegram-first parameter names
- most test helpers and test-call sites now also default to neutral binding language, leaving Telegram naming mainly in explicit compatibility-mirror assertions
- not yet complete for removing Telegram mirror columns or formalizing a platform binding model beyond the current Telegram-first product

Why later:

- schema churn is the highest-risk refactor in this direction
- Phase 1 proved the Core seam without making migration part of the first review

Start when:

- workflow and interaction-model seams are already stable
- Telegram behavior stays solid after the Phase 1 refactor

Done means:

- bridge-owned records stop using Telegram-specific ids as their primary business identity
- transport-specific ids move into delivery-reference fields or transport-scoped records
- restart recovery and final-answer callback recovery still work after migration
- migration and reopen tests exist
- auth/session binding no longer depends on Telegram-specific field names as its primary business shape

Likely areas:

- `src/types.ts`
- `src/state/store.ts`
- `src/state/store-runtime-artifacts.ts`
- `src/state/store-pending-interactions.ts`
- `src/state/store-auth.ts`
- `src/state/store-sessions.ts`
- `docs/architecture/runtime-and-state.md`

### MP-02: Add a real capability layer

Status:
- started as narrow landing-zone work only
- a narrow platform surface adapter plus minimum capability-vocabulary predesign now exists so this step can start from a concrete landing zone instead of a repo-wide abstraction jump
- a first shared surface-intent and surface-result contract now exists and is wired into Telegram pending-interaction and terminal-result delivery paths
- not yet started as a broad capability-policy rollout across workflow, presentation, and pack boundaries

Why later:

- capability work is guesswork while only one renderer exists
- semantic interaction intent needed to land first

Start when:

- the interaction model is stable
- a second renderer, second pack, or real fallback matrix is under design

Done means:

- platform abilities such as buttons, edits, uploads, previews, and long-form pagination are explicit
- fallback behavior comes from capability policy instead of scattered platform checks

Likely areas:

- future Core capability modules
- workflow decision points
- Telegram rendering fallbacks
- future Slack, Discord, or Web design docs

### MP-03: Extract a presentation layer

Why later:

- splitting renderers too early would mostly create rename-only churn

Start when:

- interaction-model inputs are stable
- capability rules exist for the major runtime and final-answer surfaces

Done means:

- Telegram rendering consumes only interaction-model inputs and capability context
- business decisions no longer live inside Telegram UI builders
- runtime, final-answer, picker, and recovery rendering boundaries are explicit

Likely areas:

- `src/telegram/ui-runtime.ts`
- `src/telegram/ui-final-answer.ts`
- `src/telegram/ui-messages.ts`
- `src/service/runtime-surface-controller.ts`

### MP-04: Formalize Telegram as the first official platform pack

Why later:

- Telegram is still mixed across transport, auth, callback, rendering, and install behavior
- extracting a pack too early would mostly move the same coupling into a new folder

Start when:

- Core interaction and workflow boundaries are stable
- Telegram rendering and transport responsibilities are easier to isolate

Done means:

- Telegram transport, auth, ingress, egress, and callback compatibility have an explicit pack boundary
- Core no longer imports Telegram concerns outside the agreed adapter edge
- Telegram is the reference pack, not the hidden default architecture

Likely areas:

- `src/service.ts`
- `src/telegram/`
- `src/install.ts`
- Telegram-related docs and skills

### MP-05: Add pack-aware install and admin support

Why later:

- the current install and admin path is intentionally Telegram-first and already large
- expanding it before pack boundaries exist would grow the wrong surface

Start when:

- the Telegram pack boundary is explicit
- at least one more pack is close enough to justify shared install logic

Done means:

- install flow can select or validate pack configuration intentionally
- doctor, status, and update can explain pack-specific readiness cleanly
- pack-specific credentials and setup steps stop being hard-coded as Telegram-only assumptions

Likely areas:

- `src/install.ts`
- `src/cli.ts`
- `src/config.ts`
- `docs/operations/install-and-admin.md`
- bundled setup skills

### MP-06: Deliver one second-platform pilot

Why later:

- adding a second platform before the seam holds would only duplicate Telegram coupling

Start when:

- capability and presentation rules are stable enough to absorb another renderer
- the Telegram Pack boundary is explicit enough to compare against

Done means:

- one additional platform can start or resume sessions, run turns, handle blocked interactions, show runtime state, and deliver final answers through the shared Core
- platform-specific code stays inside pack and presentation boundaries

Likely areas:

- a future platform pack directory
- workflow adapters
- capability policies
- install docs and setup skills

### MP-07: Add a Web or App control console

Why later:

- Web or App work is a larger product surface and should consume the Core, not drive it early

Start when:

- at least one non-Telegram path has already validated the interaction model
- runtime and final-answer semantics are stable outside Telegram chat assumptions

Done means:

- a Web or App console reuses workflow and interaction-model contracts
- it does not bypass bridge logic with a direct app-server shortcut
- session, runtime, interaction, and final-answer semantics stay aligned with the shared Core

Likely areas:

- a future console package
- presentation modules
- capability rules
- product docs and install docs

### MP-08: Decouple long-tail Telegram-owned flows

Why later:

- not every flow needed to move in Phase 1
- broad cleanup before the main seam was stable would have been churn without proof

Start when:

- the first wave has settled
- hotspots can be ranked by real coupling instead of guesses

Done means:

- session flow, project browsing, rich input, media adaptation, and long-tail command paths each have an explicit answer to whether they belong in Domain, Workflow, Interaction Model, Capability, Presentation, or Pack
- no major bridge-owned flow stays Telegram-first just because it was ignored earlier

Likely areas:

- `src/service/session-project-coordinator.ts`
- `src/service/project-browser-coordinator.ts`
- `src/service/rich-input-adapter.ts`
- `src/service/codex-command-coordinator.ts`
- relevant Telegram UI modules

## Review Gate Before Starting The Next Wave

Before activating any tracker item, confirm all of the following:

- the Phase 1 wave is verified and understood
- the deferred item still belongs after Phase 1 and was not accidentally solved already
- the next plan is narrower than "generalize more things"
- current docs and AGENTS routing still separate shipped Telegram truth from future Core direction

## Final Rule

If a future task touches multi-platform direction and is not clearly Phase 1, it should either:

- map to one tracker item above
- or add a new tracker item before work starts
