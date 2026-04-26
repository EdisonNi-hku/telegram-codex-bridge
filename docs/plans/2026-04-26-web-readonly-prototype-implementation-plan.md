<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: guardrail and route-to-future-work package for the read-only Web prototype after the first service view-model seam landed
read_when:
  - preparing future read-only Web prototype work after the first service view-model seam
  - deciding which read-only Core/state surfaces a Web prototype may inspect
  - validating screenshot-first and protected-phone readiness for the Web prototype
skip_when:
  - the request is about current Telegram or Feishu shipped behavior
  - the request asks to implement Web routes, components, servers, auth middleware, or runtime code now
source_of_truth:
  - docs/plans/2026-04-26-web-readonly-prototype-implementation-plan.md
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/operations/web-vps-mobile-access-and-security.md
  - docs/architecture/web-app-preimplementation-contract.md
-->

# Web Read-Only Prototype Implementation Plan

Status: guardrails landed; first read-only service adapter seam landed; routes/UI/auth/actions not implemented
Owner: Product / Architecture / Future implementation controller
Last updated: 2026-04-26

This is the guardrail and route-to-future-work package for a future **read-only Web prototype** of
Codex Console. The first service-level read-only view-model adapter seam has landed, including Gap1
final-answer/workspace redaction and the Gap2 pending-interactions read model. Web remains
future/prototype only; Telegram remains the current stable/default surface; Feishu remains a serious
current pack with setup and readiness caveats. No Web routes, UI, auth middleware, server, URL,
screenshots, or action controls are implemented.

The first lane is strictly read-mostly: it may render redacted state after authentication, but it
must not submit tasks, answer approvals/questions, interrupt turns, upload files, switch/resume
sessions, perform arbitrary writes, expose a raw terminal, support multi-user/team access, expose an
unauthenticated URL, or claim public Web support.

## Goal And Non-Goals

### Goal

Plan a small, non-public Web shell that lets the owner inspect shared Codex Bridge Core state from a
phone-sized browser view after login. The product shape is workspace/session/conversation centric,
closer to T3 Chat, Code Web, or the Codex app than to a generic dashboard: the owner starts from
workspaces, opens a workspace's sessions/conversations, and reads conversation results. Runtime,
readiness, and access state support that flow as context and gates before any browser control actions
are added.

### First-lane success means

- controller can capture mobile-sized screenshots/recordings for owner review without exposing a
  live owner URL;
- after auth/access control is ready, the owner can open a protected URL from a phone and inspect the
  same read-only pages;
- Web Home, Workspace Sessions, Conversation Detail / Results, Runtime, Interactions, and Setup /
  Readiness render safe empty, unavailable, degraded, and failure states;
- final answers are visually separate from progress/recent output;
- artifacts are represented by safe descriptors and availability states, not raw backing paths;
- readiness uses declared/configured/observed/UX-exposed levels instead of a single support boolean.

### Non-goals

- Web/App support claim, public release, SaaS or hosted control plane.
- Native App implementation.
- Text task submission, approval/question answers, interrupt, upload, switch/resume, archive,
  unarchive, rename, pin, rollback, compact, model selection, or any other action control.
- Raw terminal, shell prompt, command entry, or unbounded command output.
- Arbitrary project file contents, editing, diffs, or writes.
- Multi-user, team roles, unauthenticated access, or anonymous shared links.
- Repository/package/CLI/service/config/state/environment-variable renames.
- Copying Telegram callback ids, Feishu card ids, or Web component ids into Core contracts.

## Approved Page List

All pages are authenticated and read-only. If auth is not implemented or fails closed, the only
allowed owner review path is screenshots/recordings captured by the controller.

| Page | Route label for planning | What it shows in read-only mode | Must not show |
|---|---|---|---|
| Web Home | `/` or `/home` | workspace list, active workspace/session summary, recent conversations, active turn summary, compact runtime/readiness badges, degraded warnings, last update time | task box, action buttons, raw paths, raw logs, public support wording, admin-console framing |
| Workspace Sessions | `/workspaces` or `/workspaces/:workspaceId/sessions` | active workspace/session, per-workspace conversation/session rows, archived/pinned labels if already known, empty/error/unavailable states, continuation eligibility as text only | switch/resume controls, browse/write controls, raw workspace paths |
| Conversation Detail / Results | `/sessions/:sessionId` or `/conversations/:conversationId` | conversation/session detail, final answer body or safe summary, progress/result separation, artifact descriptors, availability/expired/unavailable/failure states, safe preview/download eligibility where configured | resume controls, raw artifact paths, unrestricted file reads, upload widgets, project diffs |
| Runtime | `/runtime` | compact and detailed status; idle/queued/running/blocked/done/failed/degraded/unhealthy/recovered states; recent output summary; app-server health summary | raw terminal, shell controls, verbose logs, protocol dumps, interrupt button |
| Interactions | `/interactions` | pending/resolved/expired/stale/duplicate/failed interaction cards with redacted title/body/options summaries and source turn/session labels | approve/reject/answer inputs, stale-click replay, raw payloads |
| Setup / Readiness | `/setup` or `/readiness` | declared/configured/observed/UX-exposed matrix, auth/access status, operator binding status, exposure/shutdown status, missing gate list | secrets, tokens, raw env values, config file paths, provider debug blobs |

## Candidate Core And State Surfaces To Inspect

These paths were verified against the current repo docs and source tree on 2026-04-26. They are
candidate read/adaptation surfaces for Web prototype work, not a requirement to import all of them.
The first adapter seam has landed; future work should continue from the narrowest existing owner and
remain read-only unless separately approved.

| Prototype need | Candidate surfaces to inspect first | Why they matter |
|---|---|---|
| Neutral Core terms and ids | `src/core/domain/common.ts`, `src/core/domain/context.ts`, `src/core/domain/records.ts`, `src/core/domain/binding.ts` | project/session/turn/operator vocabulary and persisted-record boundaries |
| Surface/view semantics | `src/core/interaction-model/surface.ts`, `src/core/interaction-model/runtime.ts`, `src/core/interaction-model/interaction.ts`, `src/core/interaction-model/terminal.ts`, `src/core/interaction-model/media.ts` | neutral runtime, interaction, terminal/progress, and media descriptor meanings |
| Workflow reduction | `src/core/workflow/runtime-workflow.ts`, `src/core/workflow/interaction-workflow.ts`, `src/core/workflow/terminal-workflow.ts`, `src/core/workflow/interaction-support.ts` | reducers likely closest to reusable Core output for Web view models |
| SQLite facade and records | `src/state/store.ts`, `src/state/store-records.ts`, `src/state/store-sessions.ts`, `src/state/store-pending-interactions.ts`, `src/state/store-runtime-artifacts.ts`, `src/state/store-auth.ts` | persisted sessions, recent projects, interactions, final-answer/runtime artifacts, readiness snapshots, and operator binding |
| Project/session orchestration evidence | `src/service/session-project-coordinator.ts`, `src/service/project-browser-coordinator.ts`, `src/service/current-session-card-controller.ts` | current shipped semantics for active/recent sessions and safe project visibility |
| Runtime and progress evidence | `src/service/runtime-surface-controller.ts`, `src/service/runtime-surface-state.ts`, `src/service/runtime-surface-trace-sink.ts`, `src/activity/tracker.ts`, `src/activity/types.ts` | current runtime status, progress aggregation, inspect fields, and trace boundaries |
| Interactions evidence | `src/service/interaction-broker.ts`, `src/interactions/normalize.ts` | pending/resolved/expired/stale/failed interaction lifecycle and safe normalized text |
| Final answers/artifacts evidence | `src/service/turn-coordinator.ts`, `src/service/turn-artifacts.ts`, `src/state/store-runtime-artifacts.ts` | final-answer separation, artifact descriptors, delivery/recovery clues |
| App-server and health evidence | `src/codex/app-server.ts`, `src/codex/notification-classifier.ts`, `src/service/app-server-health-guard.ts` | health/degraded state and protocol event classification; do not expose raw protocol dumps |
| Setup/readiness evidence | `src/readiness.ts`, `src/config.ts`, `src/paths.ts`, `src/packs/contract.ts`, `src/packs/registry.ts`, `src/packs/catalog.ts` | configured/observed readiness, active-pack status, and safe setup gaps |

Implementation guidance for future Web prototype work:

- prefer a small read-only view-model layer over direct Web rendering from service coordinators;
- read through existing public facades where possible, especially the store facade;
- redact at the adapter boundary, before data reaches page rendering;
- do not expose local filesystem paths, environment values, raw logs, protocol payloads, or transport
  identifiers by default;
- treat Telegram and Feishu UI files as evidence of current presentation, not as Web contracts to copy.

## Data Contract And View-Model Sketches

The sketches below are intentionally neutral field lists, not TypeScript interfaces. Future code may
rename fields, but it must preserve the safety properties: stable opaque ids, redacted labels,
summary text, explicit unavailable/failure states, and no secrets/raw paths/raw logs.

### Shared envelope for every page

| Field | Meaning | Safety rule |
|---|---|---|
| `page_id` | stable page key such as web_home, workspace_sessions, runtime, or readiness | not user-controlled |
| `generated_at` | server timestamp for the view model | no local timezone/path leakage |
| `operator` | authorized operator display label and binding status | no platform credential or chat/tenant secret |
| `auth_state` | authenticated, denied, expired, or unavailable | denied state reveals no project/runtime details |
| `environment` | local/protected-url/screenshot phase and active pack label | no hostnames, IPs, tokens, or config paths by default |
| `warnings` | redacted degraded/failure summaries | no raw stack traces or protocol dumps |
| `links` | internal page links only | no public unauthenticated links |

### Web Home view model

| Field | Meaning | Empty/unavailable behavior |
|---|---|---|
| `active_workspace` | opaque id, display label, optional redacted project label, availability | show unavailable/unknown without raw path |
| `active_session` | opaque id, title/summary, last activity, archived/pinned labels | show no active session state |
| `recent_conversations` | bounded rows with opaque ids, titles/summaries, last activity, state, artifact/final-answer hints | show empty state without implying setup failure |
| `active_turn` | opaque id, lifecycle state, progress summary, active interaction count | show idle when no active turn exists |
| `runtime_compact` | status, health color/label, last event time, degraded flags | show unknown/unhealthy with next check |
| `readiness_summary` | counts by readiness level and missing gate labels | show configured/observed gaps explicitly |
| `recent_final_answer` | answer id, summary, time, artifact count | omit body if not safely available |

### Workspace Sessions view model

| Field | Meaning | Safety rule |
|---|---|---|
| `workspaces` | rows with opaque id, display label, availability, recent-session/conversation count | path metadata must be redacted or omitted |
| `sessions` | rows with opaque id, workspace label, title, last activity, state, archived/pinned text | no resume/switch action target exposed as a control |
| `active_refs` | active project/session ids for highlighting only | not a write capability |
| `empty_state` | no workspaces, no sessions, scan unavailable, or permission issue | generic message, no sensitive path |
| `errors` | redacted scan/store errors | no stack trace or filesystem dump |

### Runtime view model

| Field | Meaning | Safety rule |
|---|---|---|
| `compact_status` | idle, queued, running, blocked, done, failed, degraded, unhealthy, recovered | use defined vocabulary only |
| `detailed_status` | active turn/session labels, app-server health, pending interaction count, delivery warnings | summarize, do not dump protocol payloads |
| `recent_output` | bounded progress summaries with timestamps and severity | not a raw terminal stream |
| `recovery` | recovered/degraded notes and next safe observation step | no restart/interrupt controls |
| `delivery_outcomes` | created, updated, deferred, partially delivered, failed, rate-limited, fallback, degraded | show failed/degraded outcomes visibly |

### Interactions view model

| Field | Meaning | Safety rule |
|---|---|---|
| `interactions` | cards with opaque id, family, title, redacted body summary, state, source turn/session | no response form or answer button |
| `states` | pending, resolved, expired, stale, duplicate, failed, canceled, superseded | terminal outcomes visible even without actions |
| `expiry` | stale/expiry time or unavailable marker | no raw callback payload |
| `options_summary` | count and safe labels only where helpful | no secret values, no action submit payload |
| `failure_summary` | redacted reason and recovery visibility | no stack trace/protocol dump |

### Conversation Detail / Results view model

| Field | Meaning | Safety rule |
|---|---|---|
| `conversation` | conversation/session id, workspace label, title, last activity, state, source turn labels | no resume/switch action target exposed as a control |
| `answers` | answer id, turn/session/workspace labels, created time, summary, body availability | body redacted or unavailable when unsafe |
| `answer_detail` | long-form final answer separate from progress | never sourced from raw terminal output alone |
| `artifacts` | artifact id, label, media type, size if known, previewability, retention/availability | no local backing path or temp path |
| `artifact_state` | pending, available, unavailable, expired, rejected, failed | unavailable is explicit, not a broken link |
| `delivery_outcomes` | final answer/artifact rendering outcomes | failed/partial/fallback shown plainly |

### Setup / Readiness view model

| Field | Meaning | Safety rule |
|---|---|---|
| `capabilities` | rows for auth, operator binding, project/session visibility, runtime, interactions, final answers, artifacts, degraded outcomes, screenshot evidence, protected phone URL | each row reports declared/configured/observed/UX-exposed |
| `auth_access` | login configured, unauthorized rejected, session revoke/logout observed, operator binding status | no cookies, tokens, session ids, raw env values |
| `exposure` | screenshot-only, protected URL ready, phone trial observed, shutdown drill status | no public hostname required in screenshots |
| `forbidden_data_check` | pass/fail/unknown for secrets, paths, raw logs, terminal, uploads/actions | failure blocks URL exposure |
| `next_gate` | owner-review, auth hardening, screenshot evidence, protected phone trial, or no-go | no support claim wording |

## Auth And Access-Control Assumptions Before URL Exposure

A live URL is not allowed until all assumptions below are true or the owner explicitly rejects the
coding task as not ready:

1. unauthenticated requests render only a generic denied/login state and no bridge data;
2. the prototype is bound to one high-trust operator/control surface;
3. login, logout, expiry, and revocation can be verified without code changes;
4. session state is server-side or equivalently protected; durable browser secrets are minimized;
5. CSRF/action protection is present before any future state-changing route exists, even though the
   first lane renders no action controls;
6. the Setup / Readiness page can say whether auth/access is declared, configured, observed, and
   UX-exposed without printing secrets;
7. the exposure mechanism is temporary or reversible, and preferably allowlisted, private-networked,
   or otherwise constrained;
8. the shutdown path is known before the URL is shared with the owner.

If any of these assumptions fail, validation remains screenshot/recording-only.

## Screenshot-First Validation Plan

Phase 1 validates information architecture and safety before owner URL exposure.

| Step | Evidence to capture | Pass condition |
|---|---|---|
| Seed or observe representative states | screenshots for empty, idle, running, blocked, done, failed, degraded/unhealthy, recovered, artifact unavailable/expired, interaction stale/failed | every approved page has at least one meaningful mobile-sized state |
| Mobile viewport review | phone-width screenshots or recordings of all pages | no horizontal scrolling for core content; final answer readable separately from progress |
| Forbidden-data review | screenshots of Web Home, runtime, conversation results/artifacts, setup, and error states | no secrets, raw env, raw paths, terminal controls, verbose logs, upload/action controls |
| Readiness review | setup/readiness screenshots | capability rows show declared/configured/observed/UX-exposed and next gate |
| Owner async review | controller shares captured evidence, not a live URL | owner can identify missing/confusing states before exposure |

Screenshot evidence should include the date, environment label, page label, and whether the view is a
synthetic fixture, live observed state, or degraded fallback. Do not include hostnames, tokens,
private paths, cookies, or raw logs in the evidence bundle.

## Protected Phone-URL Validation Plan

Phase 2/3 starts only after the screenshot-first gate and auth/access-control assumptions pass.

| Step | Pass condition | No-go condition |
|---|---|---|
| Pre-exposure auth check | unauthenticated phone/browser access sees no Web Home or state | any state renders before login |
| Operator login | owner can authenticate from phone and logout/revoke works | access is anonymous, shared, or not revocable |
| Web Home phone check | workspace list, active session, recent conversations, runtime/readiness badges, and warnings are readable | horizontal scrolling or confusing state labels block use |
| Runtime phone check | running/blocked/done/failed/degraded/unhealthy/recovered are clear without raw terminal | raw output or interrupt/action affordance appears |
| Interactions phone check | pending/resolved/expired/stale/duplicate/failed are visible as read-only | any approval/answer submit control appears |
| Answers/artifacts phone check | final answer is readable; artifact availability/unavailability is understandable | raw artifact path or unsafe download appears |
| Setup/readiness phone check | auth/access and missing gates are understandable | support claim or secret/config leak appears |
| Shutdown drill | controller can disable exposure and owner sees denied/unreachable expected state | exposure cannot be quickly stopped |

Protected phone validation is still prototype validation. It does not imply current Web support.

## Explicit Forbidden Implementation Areas For First Lane

The first coding task must not implement or expose:

- task submission or continuation text boxes;
- approval/question answer controls;
- interrupt, rollback, compact, model, skills, plugins, apps, MCP, account, or admin action controls;
- project/session switch, resume, archive, unarchive, rename, pin, browse-write, or file-edit flows;
- uploads, drag/drop, paste-to-upload, browser file picker, or generated write-back flows;
- raw terminal, command entry, shell prompt, raw unbounded output, verbose logs, stack traces,
  protocol payload dumps, or provider debug blobs;
- unauthenticated Web Home/state pages, public URLs, anonymous sharing, multi-user/team roles, or public support
  claims;
- local sensitive paths, home/temp/socket/config paths, raw artifact backing paths, tokens, env vars,
  cookies, session ids, OAuth secrets, bot tokens, or tunnel credentials;
- repository/package/CLI/service/config/state/environment-variable renames;
- native App implementation.

If a future implementer believes one of these is required to make the prototype useful, stop and ask
for owner approval before expanding scope.

## Bite-Sized Future Coding Milestones

This list is historical sequencing plus gated future work. The first service adapter seam has landed;
the next safe implementation item after closeout is Gap3 neutral artifact catalog/descriptors, still
read-only and without routes, UI, auth, servers, writes, downloads, uploads, or action controls.

1. **Read-only view-model inventory and first adapter seam — landed.** The service-level adapter
   seam, Gap1 final-answer/workspace redaction, and Gap2 pending-interactions read model exist; no
   Web routes yet.
2. **Prototype shell and auth-denied skeleton.** Add the minimal Web process/page shell with a generic
   denied/login placeholder; prove unauthenticated access sees no bridge data.
3. **Shared redaction helpers.** Implement redaction for paths, env/secrets, protocol/log text, and
   artifact handles before any page rendering.
4. **Web Home and Setup / Readiness pages.** Render workspace-oriented compact state and readiness
   matrix from safe fixtures or read-only adapters; include empty/unavailable/degraded states.
5. **Workspace Sessions page.** Render workspace list, active/recent conversation rows, and safe
   empty/error states without switch/resume controls or raw paths.
6. **Conversation Detail / Results page.** Render conversation/session detail, final-answer history,
   and safe artifact descriptors without raw paths, unrestricted file reads, or resume controls.
7. **Runtime page.** Render compact/detailed runtime, recent output summaries, health/degraded states,
   and delivery outcomes without terminal or interrupt controls.
8. **Interactions page.** Render read-only interaction cards and terminal outcomes without response
   forms.
9. **Screenshot harness.** Add a deterministic way for the controller to capture mobile-sized states
   for every page, including degraded/failure examples.
10. **Protected phone trial hardening.** Add or configure reversible exposure, auth verification,
    logout/revoke check, and shutdown drill evidence.

Do not combine action controls with these tasks. The first action lane requires a separate owner
approval package.

## Verification Commands And Evidence For Future Implementation

Minimum local checks for read-only Web view-model follow-up work:

| Check | Expected evidence |
|---|---|
| `git diff --check` | no whitespace errors |
| `npm run check` | TypeScript passes |
| targeted unit tests for new view-model/redaction code | pass output and covered redaction cases |
| route/page smoke from local controller environment | unauthenticated state denied; authenticated read-only pages render |
| manual forbidden-data review | screenshots or notes showing no secrets/raw paths/raw logs/terminal/actions |
| manual relative `.md` link check for any doc changes | every new relative doc link resolves, or note no docs changed |
| screenshot evidence bundle | mobile-sized screenshots/recordings for all approved pages and required states |
| protected phone trial evidence, only after auth gate | owner phone login/logout, denied unauthenticated access, shutdown drill result |

Future implementation evidence should include the environment, date, command output summary, and any
known no-go condition. Do not paste secrets, raw local paths, or hostnames into verification notes.

## Stop/Go Gates Before Expanding Beyond The Landed Seam

| Gate | Go condition | Stop condition |
|---|---|---|
| Owner approval | owner approves the next read-only follow-up, currently Gap3 artifact catalog/descriptors | owner has not reviewed/approved the follow-up |
| Scope lock | first lane remains read-only/read-mostly and prototype-only | any action control, upload, raw terminal, multi-user, or support claim enters scope |
| Surface inventory | implementer identifies exact read facades and redaction boundary | implementation would scrape Telegram UI output or raw logs as product state |
| Auth/access design | unauthenticated access denial and single-operator binding are designed before URL exposure | URL would show state before login or binding is unclear |
| Data safety | redaction strategy covers secrets, raw paths, logs, protocol dumps, and artifacts | view models can carry forbidden data to pages by default |
| Screenshot path | controller can capture page evidence without owner URL exposure | live URL is needed just to evaluate basic IA |
| Verification budget | coding task includes `git diff --check`, `npm run check`, targeted tests, and manual screenshot/link checks | no verifiable acceptance path exists |

If a stop condition is hit, keep Web as planning/prototype only and return to owner review rather
than coding around the gate.
