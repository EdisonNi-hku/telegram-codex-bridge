<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: executable four-phase implementation plan that finishes platform abstraction by Phase 3 and lands Feishu as the second platform in Phase 4
read_when:
  - the task is to implement the remaining multi-platform abstraction work end to end
  - the task needs one execution plan that sequences Core, capability, pack formalization, and Feishu delivery
skip_when:
  - the task is only about current shipped Telegram behavior
  - the task only needs historical phase-1 context
source_of_truth:
  - docs/future/multi-platform-core-prd.md
  - docs/plans/2026-03-23-multi-platform-core-pending-task-tracker.md
  - docs/plans/2026-03-30-platform-binding-boundary-design.md
  - docs/plans/2026-03-30-platform-surface-adapter-and-capability-prep.md
  - src/core
  - src/service.ts
  - src/telegram
-->

# Multi-Platform Core And Feishu Implementation Plan

Status: Active implementation plan
Date: 2026-04-08
Owner: Architecture / Runtime

## Purpose

This plan turns the current multi-platform direction into one executable backlog.

It uses **4 phases**, not 3:

1. finish Core and protocol truth
2. finish capability, surface, and presentation abstraction
3. formalize Telegram as a pack and make operations pack-aware
4. land Feishu as the second platform

Why 4 phases:

- the user requirement is that **platform abstraction must be fully finished after the first 3 phases**
- Feishu should land **after** that abstraction is already stable
- if Feishu is merged into Phase 3, the repository would still be mixing abstraction work with second-platform delivery, which keeps the abstraction work effectively open

## Scope

In scope:

- complete the remaining platform-neutral Core work
- finish capability and surface abstraction
- formalize Telegram as the first explicit platform pack
- make install, readiness, admin, and skill flows pack-aware
- land Feishu as the second platform using the completed abstraction

Out of scope:

- claiming broad multi-platform support before Feishu ships
- shipping Enterprise WeCom or QQ support in this plan
- forcing Telegram and Feishu into identical UX
- opening arbitrary platform APIs to the model
- renaming the repository or CLI as part of this work

## Locked Decisions

These decisions are fixed for this plan and should not be reopened unless implementation proves them unworkable:

- Use **4 phases**
- **Platform abstraction must be considered complete at the end of Phase 3**
- **Phase 4 is Feishu only**
- Feishu route is **self-built app + app bot**, not custom bot
- Feishu delivery shape is **P2P-first, single authorized user, card-first**
- Telegram compatibility mirror fields are cleaned up at the **end of Phase 2**
- Dynamic platform actions stay on a **small bridge-owned allowlist**

## Platform Action Allowlist

Do not expose arbitrary platform APIs to the model.

Allowed bridge-owned platform actions:

- send a file to the current control surface
- send an approval or questionnaire card and receive the answer
- send an authorization, bind, or confirm entry point

Not allowed:

- arbitrary platform API passthrough
- model-defined high-privilege platform actions
- unrestricted card generation as a generic tool surface
- platform-level group or org management as agent-controlled actions

## Phase Gates

### Gate After Phase 1

Shared business meaning and protocol truth are stable.
The repository can explain sessions, turns, interactions, final answers, and recovery without Telegram-first field names or Telegram-specific control flow.

### Gate After Phase 2

Capability, surface, and presentation boundaries are stable.
Telegram compatibility mirror fields are no longer needed as the main path.

### Gate After Phase 3

**Platform abstraction is complete.**
At this point, adding another platform must not require new shared-Core abstraction work.
Only new pack work is allowed beyond this gate.

### Gate After Phase 4

Feishu is shipped as the second platform and proves that the abstraction completed in the first 3 phases was sufficient.

## Global Sequencing Rules

- Do not begin Phase 2 until Phase 1 protocol truth and shared record language are stable.
- Do not delete Telegram mirrors before the Phase 2 delivery contract is already proven through tests.
- Do not begin Feishu pack implementation until Telegram has already become an explicit pack and operations are pack-aware.
- Treat any Phase 4 requirement to reopen Core abstraction as a **failure of Phase 1-3 exit quality**.

## Phase 1

### Goal

Close the shared Core and protocol boundary so Telegram is no longer the hidden language of the repository's business model.

### Intended Outcome

After Phase 1, the repository has one clear answer for:

- who the remote principal is
- what the current surface target is
- how a bridge session is owned
- how a turn is tracked
- how pending interactions are represented
- how final answers and plan results are persisted and recovered
- which protocol events are authoritative and which are only stream hints

### In Scope

- neutral business model completion
- protocol truth consolidation
- shared record and store language cleanup
- restart and recovery semantics
- dynamic platform action allowlist definition

### Out Of Scope

- presentation abstraction
- pack extraction
- Feishu delivery

### Phase 1 Backlog

[ ] Define the final shared business vocabulary for principal, chat target, binding, session ownership, turn, pending interaction, runtime notice, terminal result, and delivery reference.

[ ] Refactor shared types and store-facing public inputs so neutral names are primary and Telegram compatibility names are explicitly secondary.

[ ] Consolidate protocol truth into one authoritative path for `item/completed`, `agentMessage.phase`, `serverRequest/resolved`, blocked-turn continuation, and history-based recovery.

[ ] Define and implement the compatibility strategy for old `thread/compacted` semantics versus the newer compaction truth used by current protocol and history.

[ ] Centralize server-request support policy so approvals, questionnaires, elicitation, and the dynamic platform-action allowlist are interpreted in one place.

[ ] Finish neutral delivery-reference modeling for runtime notices, pending interactions, current session card ownership, and final-answer persistence.

[ ] Add idempotency rules for duplicate message delivery, duplicate callback resolution, resumed history replay, and stale request completion.

[ ] Add recovery rules for restart, app-server reconnect, thread resume, blocked-turn continuation, and final-answer extraction using completed items as the main truth.

[ ] Add regression tests for turn start, resume, interrupt, rollback, compact, pending interactions, commentary versus final-answer extraction, and request-id round trips.

[ ] Prove that current Telegram behavior does not regress while the shared business model stops depending on Telegram-first identifiers.

### Suggested Write Areas

- `src/core/domain/`
- `src/core/workflow/`
- `src/codex/`
- `src/interactions/`
- `src/state/`
- `src/types.ts`
- narrow supporting owners under `src/service/`

### Validation

- `npm run check`
- `npm run test`
- targeted recovery and persistence regressions for sessions, interactions, and terminal results

### Risks

- shared meaning still leaks Telegram assumptions
- completed items and delta streams are mixed incorrectly
- migration changes the primary key language without adequate dual-read safety

### Rollback

- use additive schema and dual-read strategy first
- keep compatibility mirrors intact through the whole phase
- do not delete old columns or old record decoding paths in Phase 1

### Exit Criteria

- shared business interfaces no longer require Telegram names
- final-answer recovery prefers authoritative completed items
- protocol interpretation is centralized
- Phase 2 can start without reopening shared naming or protocol truth

## Phase 2

### Goal

Make platform capability, surface delivery, and presentation explicit so Telegram stops acting as the default renderer and default fallback policy.

### Intended Outcome

After Phase 2:

- the bridge can describe delivery needs in platform-neutral language
- every visible surface goes through a shared delivery contract
- fallback behavior comes from capability policy instead of scattered Telegram checks
- Telegram compatibility mirrors are removed from the primary data path

### In Scope

- capability policy
- surface dispatcher and result contract
- presentation input contracts
- carry-forward fixes required to fully satisfy the intended Phase 1 protocol boundary
- mirror cleanup at the end of the phase

### Out Of Scope

- explicit Telegram pack extraction
- pack-aware install and admin
- Feishu implementation

### Capability Baseline

The first stable capability snapshot must cover:

- callbacks
- message edits
- rich preview
- long-form pagination
- uploads

It may later expand, but these are the required minimum for this plan.

### Surface Baseline

All user-visible delivery must route through one semantic contract for:

- runtime surface
- interaction surface
- terminal result surface

Stable result outcomes:

- `sent`
- `edited`
- `deferred`
- `failed`

### Carry-Forward Fixes From The Phase 1 Review

These are treated as **mandatory Phase 2 entry tasks**, not optional cleanup:

- fix request-id compatibility for numeric-looking string ids so legacy and canonical storage formats both resolve correctly without changing JSON-RPC id type
- complete compaction truth migration so shared runtime reacts to the current compaction truth instead of depending only on the older `thread/compacted` signal
- finish neutralizing shared interaction-delivery failure language so shared reasons and shared fallback text do not keep Telegram as the default platform name

Reason:

- these issues sit directly on the boundary between Phase 1 protocol truth and Phase 2 shared delivery semantics
- leaving them unresolved would make the Phase 2 surface contract look complete while still hiding protocol and wording bugs underneath

### Phase 2 Backlog

[ ] Fix request-id compatibility for numeric-looking string ids across serialization, storage lookup, pending-interaction resolution, and server-response dispatch, and add regression coverage for `"7"` versus `7` compatibility boundaries.

[ ] Complete compaction truth support by consuming the current compaction truth in the shared classifier and runtime-reduction path while keeping older `thread/compacted` behavior only as explicit compatibility.

[ ] Finish neutralizing shared interaction-delivery failure semantics so shared reason codes, shared messages, and shared terminal summaries no longer name Telegram unless the active renderer deliberately does so.

[ ] Promote the current narrow surface helper into one shared delivery contract used by runtime, interaction, and terminal-result surfaces.

[ ] Add a stable capability snapshot and shared fallback policy that controls edits, callbacks, preview, pagination, and uploads.

[ ] Convert runtime hubs, inspect payloads, recent output, rollback entrypoints, and runtime preference surfaces into semantic views that do not embed Telegram policy.

[ ] Convert interaction delivery to consume only semantic interaction views plus capability context, with consistent handling for approval, questionnaire, resolved, and expired states.

[ ] Convert final-answer and plan-result delivery to the same dispatcher, including direct delivery, deferred notice, re-render, expand, and retry handling.

[ ] Move deferred, fallback, rate-limit, and stale-update policy out of Telegram UI builders and into the shared dispatcher or capability layer.

[ ] Freeze presentation inputs so platform renderers receive semantic view data and explicit control descriptors rather than inventing business meaning locally.

[ ] Migrate persistence and public type surfaces away from Telegram compatibility mirrors once the shared contract is proven stable.

[ ] Remove Telegram compatibility mirror fields from the main data path at the end of the phase, with migration coverage and reopen verification.

[ ] Add a full surface matrix regression suite that validates `sent / edited / deferred / failed` behavior across runtime, interaction, and terminal results.

### Suggested Write Areas

- `src/core/interaction-model/`
- `src/core/workflow/`
- `src/core/interaction-model/surface.ts`
- `src/service/runtime-surface-controller.ts`
- `src/service/interaction-broker.ts`
- `src/service/turn-coordinator.ts`
- `src/telegram/surface-adapter.ts`
- `src/telegram/ui-*.ts`
- `src/state/`
- `src/types.ts`

### Validation

- `npm run check`
- `npm run test`
- targeted request-id compatibility regression coverage, including numeric-string ids and legacy/canonical dual-lookup behavior
- targeted compaction regression coverage for both current and compatibility event paths
- targeted shared wording checks proving interaction-delivery failure text is no longer platform-hardcoded in shared layers
- dedicated migration test for mirror cleanup
- explicit fallback behavior checks for platforms lacking edits, callbacks, or pagination

### Risks

- request-id fixes are papered over locally but not carried through every persistence and response path
- compaction truth still depends on the old notification path and silently regresses on newer runtimes
- shared failure semantics stay Telegram-named and leak the wrong platform into future packs
- capability policy becomes documentation only and not the real control point
- presentation still hides business rules
- mirror cleanup happens before contract stability is proven

### Rollback

- keep migration split into preparation and cleanup stages
- do not remove mirrors until dispatcher and renderer tests are green
- if cleanup fails, restore mirror read compatibility before touching renderer logic

### Exit Criteria

- numeric-string and legacy/canonical request-id compatibility is proven end to end
- current compaction truth is consumed in shared runtime logic, with old notification handling reduced to compatibility only
- shared interaction-delivery failure semantics are platform-neutral
- runtime, interaction, and terminal results all use one delivery contract
- capability policy controls fallback decisions
- Telegram is only one renderer, not the default business truth
- mirror cleanup is complete
- Phase 3 can start without reopening shared surface semantics

## Phase 3

### Goal

Formalize Telegram as the first explicit pack and make the operational surface pack-aware.

### Intended Outcome

After Phase 3:

- Telegram is one explicit platform pack
- shared runtime does not directly own Telegram APIs or Telegram ingress
- install, readiness, doctor, update, authorize, and skill entrypoints are pack-aware
- platform abstraction backlog is complete

### In Scope

- carry-forward fixes required because the intended Phase 2 gate was not fully satisfied in review
- Telegram pack boundary
- pack registry or equivalent bootstrap contract
- pack-aware config
- pack-aware readiness and doctor
- pack-aware install, update, authorize, skill flow

### Out Of Scope

- Feishu implementation itself

### Telegram Pack Owns

- Bot API client
- polling and offset state
- callback encoding and decoding
- command menu sync
- Telegram presentation details
- media ingress and local cache behavior
- Telegram-specific rate-limit and retry handling
- Telegram-specific auth prompts and chat restrictions

### Shared Core Must Own

- session, turn, interaction, runtime, and final-answer semantics
- app-server lifecycle semantics
- capability and surface contracts
- pack contract
- shared install manifest shape
- shared readiness and doctor result shape

### Carry-Forward Fixes From The Phase 2 Review

These are treated as **mandatory Phase 3 entry tasks**.
Do not declare Phase 3 complete until both are fixed:

- finish the compaction lifecycle so modern compaction truth does not leave stale active-item state behind when a compaction item has a full started/completed lifecycle
- finish the upload and file-send abstraction so upload capability is not just a field on the policy object while real file delivery still bypasses the shared contract

Reason:

- the first issue means modern compaction truth is present but not fully reduced through runtime state
- the second issue means the repository still has a gap between the stated shared capability model and the real file-delivery path
- both problems must be closed before platform abstraction can honestly be declared finished

### Phase 3 Backlog

[ ] Fix the compaction lifecycle reduction so `item/started(type=compaction)` plus modern compaction completion cannot leave stale active-item state in tracker, inspect, or runtime surfaces.

[ ] Add regression coverage for compaction started/completed lifecycles, not only for direct completed-truth events and history-derived compaction truth.

[ ] Finish the upload/file-delivery abstraction by routing control-surface file sending through an explicit shared action or delivery contract, instead of bypassing capability and pack boundaries with direct Telegram helper calls.

[ ] Ensure upload capability is a real control point by making capability policy and pack implementation jointly decide whether file delivery is allowed, degraded, or rejected.

[ ] Define the pack contract for ingress, egress, auth binding, capabilities, action allowlist implementation, and health checks.

[ ] Extract Telegram transport, polling, callbacks, command registry, rich input adaptation, and presentation behind the Telegram pack boundary.

[ ] Refactor service bootstrap so shared runtime selects and boots a pack instead of constructing Telegram behavior directly.

[ ] Split configuration into shared bridge config and pack-specific config with a stable selection mechanism.

[ ] Split readiness into shared health checks and pack-specific health checks, with operator-facing output that identifies the active pack cleanly.

[ ] Refactor install, update, doctor, status, and authorize flows so they execute common logic plus pack hooks instead of hard-coding Telegram assumptions.

[ ] Refactor bundled skill and install scripts so they target bridge core plus chosen pack, not Telegram-first runtime assumptions.

[ ] Partition logs, state artifacts, and diagnostics into shared versus pack-specific ownership.

[ ] Add pack-level smoke tests proving Telegram can still install, start, restart, rebind, sync commands, and recover normally inside the new structure.

[ ] Freeze the abstraction boundary and clear the platform-abstraction backlog before Phase 4 starts.

### Suggested Write Areas

- `src/service.ts`
- `src/config.ts`
- `src/readiness.ts`
- `src/install.ts`
- `src/cli.ts`
- `src/telegram/`
- shared bootstrap and pack registry locations introduced by this phase
- `skills/telegram-codex-linker/`
- install scripts under `scripts/`

### Validation

- `npm run check`
- `npm run test`
- targeted compaction lifecycle regression coverage for started/completed modern truth and history recovery truth
- targeted file-send and upload-capability coverage proving the shared contract, pack implementation, and allowlist stay aligned
- manual install and repair walkthrough on current Telegram path
- smoke test for Telegram pack enable, disable, credentials invalid, and rebind flows

### Risks

- compaction truth is classified correctly but still leaves runtime state or active-item remnants behind
- uploads remain half-abstracted and force future packs to bypass shared capability or action contracts
- shared runtime still quietly imports Telegram-specific code
- install and doctor stay Telegram-first in wording or behavior
- pack split becomes folder movement without true runtime separation

### Rollback

- keep Telegram as the only enabled pack during the migration
- stage pack-aware CLI and install changes behind compatibility-preserving defaults
- do not require fresh installs for existing Telegram users

### Exit Criteria

- compaction started/completed lifecycles fully reduce without stale active-item leakage
- file-send and upload behavior is governed by an explicit shared contract plus pack implementation, not by direct Telegram-only shortcuts
- Telegram exists as an explicit pack
- shared runtime no longer directly owns Telegram APIs
- install, readiness, admin, and skill flows are pack-aware
- **platform abstraction backlog is closed**

## Phase 4

### Goal

Implement Feishu as the second platform using the completed abstraction from the first 3 phases.

### Intended Outcome

Feishu becomes the first proof that the repository now has a real platform-neutral core rather than a Telegram-specialized refactor.

### Feishu Product Shape For This Plan

- self-built app
- app bot, not custom bot
- long connection preferred
- P2P single-user control surface first
- cards first for interactions

### In Scope

- Feishu pack
- Feishu auth and token lifecycle
- Feishu ingress and callback handling
- Feishu egress for text, card, and file delivery
- Feishu runtime, interaction, and final-answer presentation
- Feishu readiness and install support
- end-to-end validation of the second platform

### Out Of Scope

- broad Feishu org-management workflows
- custom bot mode
- full group-chat productization
- advanced voice and image parity
- generic arbitrary Feishu action support

### Feishu Constraints To Respect

- card and callback flows are synchronous and time-sensitive
- token lifecycle is app-based and tenant-based, not bot-token based
- user and chat identity shapes differ from Telegram
- card update rules and validity windows are stricter than Telegram edit flows

### Phase 4 Backlog

[ ] Implement the Feishu pack contract for auth, capabilities, ingress, egress, and platform-action allowlist support.

[ ] Add Feishu credential management and token refresh handling with shared operational reporting.

[ ] Implement Feishu message ingress for the chosen Phase 4 scope, starting with P2P single-user control flow.

[ ] Implement Feishu egress for text, card, file, and deferred-result fallback using the shared surface contract.

[ ] Implement Feishu interaction handling for approvals, questionnaires, and authorization entrypoints using card-first flows.

[ ] Implement Feishu runtime and terminal-result renderers that consume the shared semantic views without reopening shared abstraction work.

[ ] Implement Feishu install, readiness, doctor, and authorization hooks in the pack-aware operations layer.

[ ] Add an end-to-end validation script or checklist that proves session selection, turn execution, approval, runtime updates, final answer, file sending, and restart recovery all work.

[ ] Validate that adding Feishu required no new shared abstraction layer; if it did, fail the phase and reopen the earlier gate explicitly.

[ ] Prepare the follow-up template for future platform packs so enterprise WeCom or QQ can be planned as pack work only.

### Suggested Write Areas

- new Feishu pack locations introduced by Phase 4
- pack-aware bootstrap and operations files from Phase 3
- shared presentation and capability contracts only if gaps are proven and explicitly accepted

### Validation

- `npm run check`
- `npm run test`
- integration validation against a real Feishu tenant and one real authorized user
- restart and recovery walkthrough
- callback timeout and fallback behavior checks

### Risks

- Feishu callback timing rules stress current runtime design
- token lifecycle and identity model leak back into shared abstractions
- card update limits force unexpected fallback behavior

### Rollback

- ship Feishu behind its own pack enablement path
- keep Telegram production path isolated
- enable Feishu ingress and egress in controlled steps

### Exit Criteria

- one real authorized user can operate Codex from Feishu end to end
- Feishu uses the existing shared contracts without forcing new abstraction work
- the repository can now add future platforms as pack projects rather than architecture rewrites

## Testing Strategy Across All Phases

### Shared Automated Checks

- `npm run check`
- `npm run test`

### Required Regression Families

- protocol classification and recovery
- pending interaction lifecycle
- final-answer extraction and commentary separation
- runtime surface delivery and fallback
- migration coverage for persistence changes
- install and readiness behavior

### Required Manual Gates

- current Telegram user journey must remain operational through Phases 1-3
- Phase 4 must validate one real Feishu tenant and one real authorized user

## Rollout Strategy

- keep Telegram as the only active production pack until Phase 4 validation is complete
- use additive schema and compatibility reads before destructive cleanup
- ship each phase behind stable gates rather than one long-lived mega-branch
- do not start the next phase until the previous phase gate is explicitly accepted

## Suggested Branching And Merge Order

For each phase:

1. land shared contracts and tests
2. land narrow owner refactors
3. land migration and cleanup
4. land operator-facing docs and scripts

Do not bundle two phase gates into one merge train.

## Failure Rules

Treat these as real failures, not normal spillover:

- Phase 2 needs to redefine Phase 1 business meaning
- Phase 3 needs to reopen Phase 2 surface semantics
- Phase 4 needs to add new shared abstraction layers instead of only consuming them

If any of those happen, stop and reopen the previous phase instead of silently expanding scope.

## Final Acceptance

This plan succeeds only when all of these are true:

- Phase 1 made protocol truth and shared language stable
- Phase 2 completed capability, surface, and presentation abstraction
- Phase 3 completed Telegram pack formalization and pack-aware operations
- **platform abstraction is finished before Feishu starts**
- Phase 4 lands Feishu without reopening shared-core architecture work
