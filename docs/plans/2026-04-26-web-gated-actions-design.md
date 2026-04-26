<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: docs-only design gate for future gated Web submit, approval-answer, and interrupt actions after the read-only owner-visible MVP
read_when:
  - designing future Web action controls after the read-only owner-visible MVP
  - checking action preconditions, safety model, audit requirements, acceptance checklists, or rollback gates
  - deciding whether Web submit, approval-answer, or interrupt may be implemented
skip_when:
  - the task is only about current Telegram or Feishu shipped behavior
  - the task is only about current read-only Web prototype behavior
  - the task needs source implementation details for Web routes, auth middleware, or app-server calls
source_of_truth:
  - docs/plans/2026-04-26-web-gated-actions-design.md
  - docs/plans/2026-04-26-web-protected-owner-access-plan.md
  - docs/plans/2026-04-26-web-first-phase-1-closeout.md
  - docs/plans/2026-04-26-web-first-pm-ledger.md
-->

# Web Gated Actions Design

Status: design gate complete; docs-only phase; no Web actions implemented or enabled  
Owner: Hermes/Tuzi controller; Codex runs are implementation/review subagents  
Last updated: 2026-04-26

## Decision Summary

Web actions are **not implemented, enabled, safe, or supported now**.

The current Web prototype remains read-only, local-only by default, and token-gated. It exposes owner-safe
workspace rows, recent conversations, and opaque `cv_...` conversation detail handles. Protected owner
access must pass first, and the read-only owner-visible MVP must be accepted before any action work starts.

The action path is intentionally sequenced so future implementation cannot jump straight to task
submission. Each lane must prove owner auth, binding, anti-replay, audit, and rollback before the next lane
is considered.

## Action Taxonomy And Required Sequence

Actions must land in this order. Skipping a lane is a no-go.

| Lane | Action | Purpose | Required posture |
|---|---|---|---|
| 0 | No-op readiness check or action capability display | Show whether the current session could ever accept actions, and why an action is disabled. | Read-only, no state mutation, no app-server write, no platform callback. |
| 1 | Answer an already-pending approval/question | Let the owner choose one allowlisted answer for an existing pending interaction. | Opaque action handle, allowlisted choices only, preview, CSRF/replay/idempotency, audit. |
| 2 | Interrupt/stop current turn | Let the owner stop the current Codex turn when a running turn is clearly active. | Explicit confirmation, interrupt-specific audit, generic stale/duplicate denial, recovery state. |
| 3 | Submit a new task | Start a new Codex task from Web. | Only after workspace, binding, session semantics, lifecycle visibility, and audit are proven. |

Lane 0 is the first implementation candidate because it is a safe diagnostic surface. It may explain that
actions are unavailable, but it must not create action handles that can mutate state.

## Hard Preconditions Before Any Web Action

No Web action lane may be implemented until all of these are true and evidenced:

1. **Protected owner access gate passed.** Owner-only protected access has passed its auth/session,
   ingress, denial, and shutdown checklist.
2. **Read-only MVP accepted.** Owner can inspect useful read-only workspace/conversation state without
   public exposure, action controls, raw IDs, local paths, terminal output, or payload leaks.
3. **Explicit owner auth/session.** The request is tied to a revocable owner session, not a bearer token in
   a URL and not an unauthenticated local page.
4. **Single resolved binding/platform.** The server resolves exactly one owner/operator binding and one
   platform scope before rendering or accepting an action.
5. **CSRF/replay protection or equivalent.** Browser-origin action posts include anti-CSRF protection or an
   equivalent same-origin/session-bound proof.
6. **Action audit log.** The server records action attempts, denials, accepted decisions, and outcomes
   without secrets or raw platform identifiers.
7. **Idempotency/action nonce.** Every action attempt uses a one-time server-issued nonce or idempotency key
   scoped to the owner session and action handle.
8. **Confirmation for destructive or interruptive actions.** Interrupt and any action that may discard work,
   stop a turn, or approve risky behavior requires an explicit confirmation step.
9. **Rollback path.** Operators can disable all Web actions, revoke sessions, expire nonces, and verify
   read-only Web still works.
10. **Generic stale/duplicate denial.** Stale, duplicate, replayed, unknown, cross-session, or cross-binding
    action attempts fail with the same safe denial shape.

If any precondition regresses, the correct behavior is to disable all Web actions and preserve read-only
access only.

## Safety Model

The first action lanes are narrow owner decisions, not a Web terminal.

Required safety boundaries:

- no raw terminal, shell prompt, arbitrary command runner, or raw command execution UI;
- no uploads, downloads, file writes, previews, artifact retrieval, or file picker in the first action lane;
- no free-form approval payloads initially; owner choices must come from a server-provided allowlist;
- no raw callback data, app-server payloads, platform IDs, chat IDs, user IDs, session IDs, or local paths in
  the UI, URLs, action forms, logs, or errors;
- action handles are opaque, server-scoped, owner-session-scoped, binding-scoped, and short-lived;
- stale, duplicate, replayed, expired, unknown, wrong-session, or wrong-binding actions are denied
  generically;
- action rendering must be derived from Web-safe ViewModels, not raw platform callbacks or app-server
  payload dumps;
- action controls must fail closed when runtime/readiness state is degraded or ambiguous;
- action failure must leave owner-visible recovery state instead of silently hiding the pending interaction.

Approval answering has an additional constraint: the Web UI may only submit the opaque pending-interaction
handle plus one allowlisted choice token. It must not let the browser construct arbitrary approval payloads,
commands, arguments, file paths, or protocol fields.

## Per-Action Acceptance Checklists

### Action 0: Readiness Check / Capability Display

Acceptance before merging lane 0:

- displays action capability as disabled by default until all hard preconditions are true;
- explains unavailable actions with owner-readable reasons such as `protected_access_not_ready`,
  `binding_ambiguous`, `runtime_degraded`, or `action_lane_disabled`;
- does not expose raw IDs, platform payloads, callback data, tokens, file paths, or terminal output;
- creates no mutation-capable nonce or action handle;
- covered by view-model and HTTP/auth tests for ready, degraded, unauthenticated, stale, and ambiguous
  states.

### Action 1: Approval / Question Answer

Acceptance before enabling approval-answer:

- only answers a pending interaction that already exists in the resolved owner binding/session scope;
- pending interaction is rendered through a Web-safe summary and opaque action handle;
- available answers are server-provided allowlisted choices; no free-form browser-supplied payload is
  accepted;
- owner sees a preview of the exact decision label and consequence class before submit;
- POST requires owner session, same-origin/CSRF proof, action nonce, and idempotency key;
- stale, duplicate, replayed, expired, wrong-choice, wrong-binding, wrong-session, and already-answered
  attempts are denied generically;
- accepted decision is auditable with actor/session label, binding/platform label, action handle hash,
  decision label, timestamp, and outcome;
- UI refreshes to a clear post-action state: accepted, denied, stale, already handled, or runtime unavailable;
- negative tests prove no raw callback data, protocol fields, platform IDs, local paths, token, or free-form
  choice text leaks into HTML, URL, logs, or errors;
- global Web-action kill switch disables the control without disabling read-only pages.

### Action 2: Interrupt / Stop Current Turn

Acceptance before enabling interrupt:

- only appears when a running turn is clearly active for the single resolved owner binding/session scope;
- disabled state is explicit when no turn is running, runtime state is ambiguous, or protected access/action
  gates are incomplete;
- owner must confirm the interrupt with an explicit preview that says the current turn may stop and partial
  work may remain unresolved;
- POST requires owner session, same-origin/CSRF proof, action nonce, and idempotency key;
- stale, duplicate, replayed, expired, wrong-binding, wrong-session, already-stopped, and no-active-turn
  attempts are denied generically;
- accepted interrupt is auditable with actor/session label, binding/platform label, target turn handle hash,
  confirmation result, timestamp, and outcome;
- UI shows clear recovery state after the action: stopping, stopped, already stopped, failed generically, or
  runtime unavailable;
- tests prove duplicate interrupts do not send duplicate stop requests;
- rollback can disable interrupt alone or all Web actions globally while keeping read-only pages available.

### Action 3: Submit New Task

Submit-new-task is last because it creates new Codex work rather than answering existing state.

Acceptance before enabling submit:

- workspace, binding, session, and conversation ownership semantics are documented and implemented;
- owner can see where the new task will land before submit: workspace label, platform/binding label,
  conversation/session target, model/profile if relevant, and audit destination;
- task body handling is intentionally scoped; no uploads, downloads, file paths, artifact references, raw
  terminal input, or arbitrary command launcher are included in the first submit lane;
- optional fields are allowlisted and rendered from server-owned capabilities, not arbitrary browser payloads;
- POST requires owner session, same-origin/CSRF proof, action nonce, and idempotency key;
- duplicate or replayed submits cannot create duplicate tasks;
- accepted submit creates owner-visible lifecycle state immediately: queued, running, blocked, failed, or
  completed reference;
- audit records the safe task summary hash/length, target handles, actor/session label, binding/platform
  label, timestamp, idempotency key hash, and outcome;
- negative tests prove no raw platform IDs, local paths, tokens, callback payloads, terminal logs, or hidden
  file-write controls appear in UI, URL, logs, or errors;
- rollback can disable submit alone, expire submit nonces, and leave already-created tasks visible as normal
  read-only conversation state.

## Audit And Logging Requirements

Audit is mandatory before actions, and audit must be safe to retain.

Log for each action attempt:

- timestamp and monotonic sequence if available;
- action lane and action type;
- safe actor/session label or hash;
- safe platform/binding label or hash;
- opaque action handle hash, never the raw handle when avoidable;
- action nonce/idempotency key hash;
- route family and result class: accepted, denied, stale, duplicate, replay, expired, wrong scope, failed,
  or killed by switch;
- decision label for allowlisted approval choices, not raw payload contents;
- confirmation result for interruptive actions;
- lifecycle outcome if known, or follow-up correlation handle hash if outcome is asynchronous.

Never log:

- real secrets, tokens, cookies, Authorization headers, CSRF tokens, session secrets, or nonce raw values;
- raw platform IDs, chat IDs, user IDs, message IDs, callback data, app-server payloads, local paths, config
  paths, artifact backing paths, env values, stack traces, terminal output, or command stdout/stderr;
- full task body, full conversation text, uploaded file contents, approval payload JSON, or arbitrary browser
  form bodies;
- real protected URLs, hostnames, public IPs, or tunnel names in durable docs or committed fixtures.

## UX Requirements

The Web surface must remain a Console, not a fake chat shell.

Required UX behavior:

- show actions beside the relevant workspace/conversation/runtime state, not as a generic chat input;
- unavailable actions are visible only when useful and are disabled with clear owner-readable reasons;
- every mutating action has an explicit preview; interruptive/destructive actions require confirmation;
- pending, submitting, accepted, denied, stale, duplicate, failed, and recovered states are visually distinct;
- browser refresh/back/duplicate-click behavior is safe and idempotent;
- errors are generic where needed for safety but still tell the owner what safe recovery is available;
- no raw callback strings, protocol payloads, platform IDs, local paths, terminal output, or debug panels are
  rendered;
- forms use opaque handles and server-owned choices only;
- action controls disappear or disable immediately when the action lane kill switch is active.

## Test Plan

Minimum verification before any implementation PR may claim an action lane is ready:

1. **Service/view-model tests** for action capability, disabled reasons, pending interaction summaries,
   confirmation models, opaque handles, stale states, and redaction.
2. **HTTP/auth tests** for unauthenticated denial, wrong owner session, wrong binding, wrong platform,
   missing session, generic unsafe routes, and no-store/security headers.
3. **CSRF/replay/idempotency tests** for missing CSRF, wrong CSRF, reused nonce, expired nonce, duplicate
   POST, replay after session revoke, and idempotent retry of accepted actions.
4. **Integration smoke** for the full owner flow of each lane using safe local state: render, preview,
   submit/confirm, refresh, observe lifecycle, then shut down.
5. **Negative leak tests** that assert HTML, URLs, headers, logs, errors, snapshots, and status output do not
   contain tokens, raw IDs, callback data, local paths, terminal text, command output, or protocol JSON.
6. **Action wording tests** or fixtures that verify labels do not overclaim public support, service support,
   mobile readiness, arbitrary command execution, upload/download support, or safety beyond the passed lane.
7. **Kill-switch tests** proving all Web actions can be disabled globally and individually while read-only
   pages still return expected authenticated state.
8. **Rollback smoke** proving sessions can be revoked, nonces expired, the action lane disabled, and stale
   browser tabs denied generically.

## Rollback And Kill Switch

Before enabling any lane, operators need a practiced rollback:

1. Disable all Web actions globally through a single config/env/flag or equivalent runtime switch.
2. Optionally disable one lane independently, starting with submit and interrupt.
3. Revoke owner Web sessions.
4. Expire all outstanding action handles, CSRF proofs, idempotency keys, and nonces.
5. Stop protected exposure if the incident involves owner-access risk.
6. Verify stale browser tabs and duplicate posts receive only generic denial.
7. Verify authenticated read-only Web Home and `cv_...` conversation detail still work.
8. Record safe audit proof of disablement, session revocation, nonce expiry, and read-only recovery without
   secrets, real URLs, hostnames, raw IDs, or tokens.

Rollback success means the owner can still inspect read-only state while no Web action can mutate Codex,
platform, session, or file state.

## Non-Goals

This design does not authorize or implement:

- public exposure, public support, mobile support, service support claims, or service availability claims;
- multi-user, team, organization, shared-browser, or delegated-access semantics;
- uploads, downloads, artifact download, previews, file picker, paste-to-upload, or write-back flows;
- raw terminal, shell prompt, arbitrary command execution, command stdout/stderr panels, or debug logs;
- raw app-server payload, callback-data, platform-ID, local-path, or config-path rendering;
- free-form approval payloads or browser-constructed protocol fields;
- task submission before protected owner access, binding/session semantics, lifecycle visibility, and audit are
  proven;
- combining action work with protected public exposure, reverse proxy/DNS/tunnel setup, service startup,
  native App work, or support-claim wording.
