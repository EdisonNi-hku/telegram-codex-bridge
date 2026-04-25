<!-- docmeta
role: leaf
layer: 3
parent: docs/architecture/README.md
children: []
summary: current bridge-versus-platform decoupling status, including what has landed, what remains Telegram-shaped, and which gaps are still real
read_when:
  - the request is about current bridge versus platform separation progress
  - the request asks what has already been decoupled and what is still Telegram-shaped
  - the request needs a current-truth summary before opening plans or future direction docs
skip_when:
  - the request is only about one narrow pack contract or one narrow owner file
  - the request is only about future multi-platform direction rather than current implementation status
source_of_truth:
  - docs/architecture/platform-decoupling-status.md
  - docs/architecture/current-code-organization.md
  - docs/architecture/platform-pack-boundary.md
  - docs/architecture/runtime-and-state.md
  - docs/operations/install-and-admin.md
  - src/core
  - src/packs
  - src/service.ts
-->

# Platform Decoupling Status

Verified against the current implementation on 2026-04-10.
Naming reviewed on 2026-04-25.

Use this file when the question is:

- how far the bridge-versus-platform split has actually landed
- what is already platform-neutral in code today
- what still depends on Telegram-shaped service and rendering assumptions
- what is safe to claim now without blending current truth and future intent

This file is current implementation truth.
It is not the future multi-platform Core PRD and it is not a historical plan snapshot.

Naming baseline:

- external product name is **Codex Console**
- internal shared architecture name is **Codex Bridge Core**
- repository/package compatibility name remains `telegram-codex-bridge`
- Telegram is the stable first pack and default path
- Feishu is a serious current pack, not a proof that broad multi-platform maturity is complete

## Current Truth In One Screen

- the repo now has a real internal Core seam under `src/core/`
- the repo now has a real pack boundary under `src/packs/`
- active-pack selection, runtime startup, readiness, install, and skill installation are pack-aware
- Telegram and Feishu are current packs
- a first capability and surface-delivery vocabulary has landed and is already used in selected delivery paths
- shared bridge services still contain substantial Telegram-shaped shell logic
- Telegram remains the default shipped path even though the implementation is no longer purely Telegram-hardcoded

So two statements are true at the same time:

- the bridge has materially moved beyond a Telegram-only internal architecture
- Codex Bridge Core is not yet a fully platform-neutral product core

## What Has Already Been Decoupled

### 1. Shared bridge semantics

`src/core/` now owns bridge-level meaning for:

- domain records and bridge-owned references
- interaction, runtime, and terminal semantic views
- workflow helpers for status, interaction, and terminal-result reduction

This is the most important landed seam.
Current Core modules do not import Telegram UI or `src/service/` owners.

### 2. Platform pack boundary

`src/packs/` now owns:

- active-pack lookup
- pack metadata and capability snapshots
- runtime factories
- pack health checks
- pack-specific dynamic tool declarations
- pack-specific server-request interpretation

Current supported packs are:

- `telegram`
- `feishu`

That means pack selection is no longer documentation-only.
It is part of runtime, readiness, install, and dynamic tool behavior.

### 3. Capability and surface vocabulary

The current code now has shared contracts for:

- platform capabilities such as callbacks, edits, uploads, previews, and pagination
- semantic surface intents such as runtime, interaction, and terminal-result delivery
- shared delivery outcomes such as sent, edited, deferred, and failed
- bridge-owned platform actions for file and image delivery

This slice is real, but still partial.
It covers meaningful delivery paths without yet replacing every Telegram-specific fallback rule in the bridge.

### 4. Partial presentation split

Several service owners now follow this shape:

1. build a semantic view in Core or service workflow
2. render that view through Telegram UI builders
3. dispatch the rendered surface

This is already visible in runtime status, interaction cards, inspect views, rollback views, and terminal-result delivery.

### 5. Pack-aware operations

Install and admin flows are no longer fully Telegram-hardcoded.
Current operations already support:

- `BRIDGE_PACK`
- `ctb install --pack <name>`
- `ctb install-skill --pack <name>`
- pack-specific env decoding
- pack-aware readiness and control-surface sync

This matters because pack support is now an operator-visible runtime boundary, not only an internal type boundary.

## What Is Still Only Partially Decoupled

### 1. The top-level service shell

`src/service.ts` is still the main bridge shell and it remains heavily Telegram-shaped.
It still directly owns or imports:

- Telegram API and poller types
- Telegram command sync
- Telegram send, edit, delete, and pin flows
- Telegram image and voice cache handling
- Telegram-flavored message and callback plumbing

Feishu currently plugs into that shell through Telegram-compatibility adapters rather than through a fully platform-neutral top-level runtime shell.

### 2. Presentation and delivery execution

The bridge now has semantic view models, but most actual rendering and delivery still routes through Telegram-specific builders and markup types.

The main remaining pressure points are:

- `src/service/runtime-surface-controller.ts`
- `src/service/interaction-broker.ts`
- `src/service/turn-coordinator.ts`
- `src/telegram/ui-runtime.ts`
- `src/telegram/ui-final-answer.ts`

These areas are no longer the only home of bridge semantics, but they still own a large amount of platform-specific execution logic.

### 3. Long-tail product flows

Session management, project browsing, rich input, media ingress, and command UX are not yet fully expressed through the same clean Core -> capability -> presentation -> pack split.

The repo already has better boundaries than before, but long-tail flows still need explicit answers to whether they belong in:

- Core
- Capability
- Presentation
- Pack
- or the shared bridge shell

## What Is Safe To Claim Now

Safe:

- the repo has a real internal bridge-versus-platform seam
- the repo has a real pack boundary
- Telegram is the stable first pack and Feishu has landed through the current pack model
- current abstraction work is materially beyond Phase 1-only groundwork

Not safe:

- claiming Codex Console is already fully platform-neutral
- claiming Telegram is now only a thin renderer
- claiming future platforms will require no more shared abstraction work
- using Feishu support as proof that all Telegram-first assumptions are gone

## Current Remaining Gaps

The most important remaining gaps are:

- replacing the Telegram-shaped top-level service shell with a cleaner platform-neutral runtime boundary
- finishing the presentation split so visible surfaces depend on semantic view contracts more consistently
- reducing Telegram-first assumptions in long-tail service flows
- tightening the line between shared delivery policy and pack-specific execution
- continuing to separate current truth from future-Core intent in docs and plans

## Read Next

- For the exact current pack contract: `platform-pack-boundary.md`
- For the current owner map after the first Core seam landed: `current-code-organization.md`
- For current runtime and persistence rules: `runtime-and-state.md`
- For operator-visible pack behavior: `../operations/install-and-admin.md`
- For the future target beyond the current state: `../future/multi-platform-core-prd.md`
