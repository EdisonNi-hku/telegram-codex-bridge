<!-- archived: moved from active plans after Phase 3 closeout; historical reconstruction only. Start new work from docs/roadmap/codex-console-continuation-brief.md. -->
<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: PM-facing command board for Web-first Codex Console continuation, covering scope, owners, gates, reporting, and VPS/mobile validation
read_when:
  - coordinating Web-first Codex Console work as a project manager
  - reviewing what should happen before Web prototype implementation
  - preparing status reports for owner review
skip_when:
  - the request is about current Telegram or Feishu shipped behavior
  - the request is asking for implementation details after the current Web MVP scope is already approved
source_of_truth:
  - docs/plans/2026-04-26-web-first-project-command-board.md
  - docs/architecture/web-app-preimplementation-contract.md
  - docs/roadmap/codex-console-continuation-brief.md
-->

# Web-First Project Command Board

Status: active PM command board
Owner: Product / Project Lead
Last updated: 2026-04-26

## Executive Decision

Codex Console should proceed **Web first, App later**.

This does not cancel App. It keeps App out of the first implementation lane so the team can validate shared Core contracts, readiness reporting, and a browser-based control surface before paying the extra cost of app packaging, updates, device permissions, and native notification models.

## Current Position

- Current shipped/default surface remains Telegram.
- Feishu is a serious current pack with setup/readiness caveats.
- Web is future work and must not be claimed as currently supported.
- App is a later product lane that should reuse the same backend/Core contracts proven by Web.
- The current environment is VPS/Linux-first; owner validation is usually by mobile browser, not by opening a browser on the server.

## Management Goal

Create a safe, staged path from chat-based Codex Console toward a Web control console.

The first outcome is not a polished product. The first outcome is decision-quality evidence:

1. the Web surface can consume Core project/session, runtime, interaction, final-answer, artifact, and readiness state;
2. the user can eventually access it from a phone through an exposed URL with login/access control;
3. the team can say exactly which readiness gates passed before making any public support claim.

## Non-Negotiable Boundaries

- Web-only for the current lane; App stays later.
- Documentation and planning before implementation.
- No public Web support claim until readiness gates pass.
- No unauthenticated public URL.
- No raw terminal exposure in the first Web lane.
- No arbitrary project writes in the first Web lane.
- No multi-user/team collaboration in the first Web lane.
- No repo/package/CLI/service/env-var rename as part of Web prototype work.
- Current Telegram/Feishu truth must remain separate from future Web direction.

## Work Packages

| ID | Work package | Lead | Support | Output | Acceptance |
|---|---|---|---|---|---|
| W1 | PM command board | Project lead | None | This board | Owner can review route, boundaries, and reporting shape. |
| W2 | Web MVP/readiness draft | Codex high | Project lead | Independent PM-facing report | Defines MVP pages, readiness levels, risks, and phased gates without writing code. |
| W3 | Controller triage | Project lead | Codex report | Approved scope cut | Removes overdesign, fixes Web-only first lane, marks deferred App/team/raw-terminal items. |
| W4 | Formal docs landing | Codex high + project lead | Existing docs | Web MVP scope + readiness model docs | Linked from continuation brief/routers; no overclaim; checks pass. |
| W5 | VPS/mobile access plan | Codex high + project lead | Ops docs | URL/login/security plan | Supports early screenshots and later phone-access URL with auth. |
| W6 | Independent review | Codex high | Project lead | Blocker-focused review | Checks overclaim, safety, routing consistency, and mobile/VPS validation assumptions. |
| W7 | Progress ledger and status reports | Project lead | None | Maintained phase notes | Owner can ask anytime and get current state, last verification, blockers, and next action. |

## Phase Plan

### Phase A — Decide Scope Before Coding

Goal: make the first Web lane small enough to execute safely.

Deliverables:

- Web MVP scope draft.
- Readiness model draft.
- VPS/mobile validation plan.
- Owner-readable status summary.

Exit criteria:

- First Web MVP pages are named.
- First Web MVP explicitly excludes App, raw terminal, multi-user, project writes, and public unauthenticated access.
- The readiness model defines declared/configured/observed/UX-exposed for each baseline journey.
- Owner can review the plan without reading code.

### Phase B — Prepare Prototype Implementation Plan

Goal: prepare a non-public Web prototype plan only after readiness is clear.

Deliverables:

- implementation plan for read-only Web prototype;
- exact Core/state surfaces to read;
- security/access model;
- screenshot-first validation flow;
- external URL validation flow for mobile.

Exit criteria:

- prototype plan names allowed files and forbidden areas;
- security model is approved before exposing any URL;
- no public support claim is introduced.

### Phase C — Build Non-Public Web Prototype

Goal: validate feasibility, not launch product.

Initial page candidates:

1. Web Home: workspace list, active workspace/session, recent conversations, contextual health/degraded state.
2. Workspace Sessions: per-workspace session/conversation list and read-only selection state.
3. Conversation Detail/Results: completed answer and generated file/image references.
4. Runtime: running/blocked/done/failed and recent output summary as supporting context.
5. Interactions: pending approval/question display, initially protected or read-only if needed.

Exit criteria:

- can run on VPS;
- project lead can capture screenshots for owner review;
- later exposes an authenticated URL for phone validation;
- no dangerous actions are available before approval.

## Readiness Model To Formalize

Each Web capability should be tracked at four levels:

1. **Declared** — the system says the capability exists.
2. **Configured** — required config, server process, auth, storage, and paths are present.
3. **Observed** — a real run exercised the capability successfully.
4. **UX-exposed** — the owner can use it through UI, not just internal APIs.

Baseline capabilities:

- operator login/access control;
- project/session visibility;
- task/runtime status visibility;
- blocked interaction visibility;
- final answer visibility;
- artifact/file visibility;
- degraded/failure visibility;
- mobile-access URL validation;
- screenshot/recording evidence path.

## VPS And Mobile Validation Strategy

Early validation:

- run locally on VPS;
- project lead captures screenshots or short recordings;
- owner reviews layout, wording, and information architecture from media.

Later validation:

- expose a controlled URL;
- require login/access token or equivalent access control;
- owner opens from phone;
- validate real read-only flows before enabling actions.

Security notes:

- never expose a raw unauthenticated server;
- use screenshots/recordings as the early validation path;
- expose a temporary or allowlisted URL only after login/access control is ready;
- keep secrets, local paths, raw logs, and terminal-like output behind explicit controls;
- do not enable write actions until reviewed.

## Reporting Format

Use this short status format for owner updates:

```text
Phase: <A/B/C>
Status: green/yellow/red
Done: <1-3 bullets>
Now: <current work>
Next: <next work>
Blockers: <none or concrete blocker>
Verification: <commands/evidence>
Decision needed: <yes/no + question>
```

## Current Closeout State

The initial command-board sequence has moved beyond W2. Current accepted outputs are:

- W2 independent Web MVP/readiness report: complete.
- W3 controller triage: complete.
- W4 formal Web MVP scope/readiness docs: complete.
- W5 VPS/mobile access and security plan: complete.
- W6 independent review: completed with one action-control wording blocker, now tracked for closeout.

Next work after closeout is Web prototype implementation planning, not coding: define the read-only Core/state surfaces, auth/access model, forbidden-data redaction, screenshot evidence path, and protected-URL rollback path.
