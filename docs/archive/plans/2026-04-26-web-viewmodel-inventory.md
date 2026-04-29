<!-- archived: moved from active plans after Phase 3 closeout; historical reconstruction only. Start new work from docs/roadmap/codex-console-continuation-brief.md. -->
<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: implementation-facing inventory of read-only Core/state/source facades and landed service adapter seam for the future workspace/session-centric Web prototype
read_when:
  - understanding the landed first read-only Web view-model adapter and remaining read-only gaps
  - deciding which current bridge state/runtime surfaces may feed Web Home, workspaces, sessions, conversation results, runtime, or readiness
  - checking redaction gaps before rendering future Web prototype data
skip_when:
  - the request is about current Telegram or Feishu shipped behavior
  - the request asks to add Web routes, auth middleware, task submission, approval answers, interrupts, uploads, or writes
source_of_truth:
  - docs/plans/2026-04-26-web-viewmodel-inventory.md
  - docs/plans/2026-04-26-web-readonly-prototype-implementation-plan.md
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/operations/web-vps-mobile-access-and-security.md
-->

# Web Read-Only View-Model Inventory

Status: planning inventory landed; first read-only service adapter seam plus Gap1/Gap2 landed; no Web routes/UI/auth/server
Owner: Product / Architecture / Future implementation controller
Last updated: 2026-04-26

This inventory names the current bridge/server Core, state, and service surfaces that a future
read-only Web prototype should adapt into safe page view models. It is now also a planning/history
artifact for the landed first service-level read-only adapter seam: the initial adapter exists, Gap1
final-answer/workspace redaction exists, and Gap2 pending-interactions read model exists. It does not
authorize Web routes, servers, auth middleware, task submission, approval answers, interrupts,
uploads, switch/resume controls, arbitrary writes, raw terminal access, public URLs, multi-user
access, or a Web support claim.

Telegram remains the stable/default shipped surface. Feishu remains a serious current pack with
setup/readiness caveats. Web remains future/prototype only.

## 1. Executive Summary

The first useful Web slice is a read-only view-model adapter that composes existing bridge
state and in-memory runtime state into redacted page DTOs. It should not render directly from
Telegram UI code, Feishu card code, raw app-server payloads, SQLite rows, or local filesystem paths.

Recommended first seam: the small read-only service adapter and unit tests have landed, to be
consumed later by any Web route/component layer. This seam is narrow enough to use the existing `BridgeStateStore` public facade, current
`TurnCoordinator`/`ActivityTracker` read getters, readiness snapshots, pack capability metadata, and
safe Core view semantics without creating a Web server or changing runtime behavior.

The landed adapter should continue to return explicit unavailable/degraded states when data is missing. It should
prefer persisted bridge rows for workspaces, sessions, interactions, final-answer delivery records,
notices, and readiness; use active in-memory runtime getters only for live turns; and keep any
app-server thread reads optional and redacted.

## 2. Product Shape: Home / Workspaces / Sessions-Conversations / Detail-Results

The product shape is workspace/session/conversation-centric, similar in spirit to a chat/workspace
product rather than a generic admin surface:

1. **Web Home**: recent and active workspaces, active session/conversation, recent conversations,
   current turn summary, compact contextual runtime/readiness badges, and warnings.
2. **Workspaces**: workspace rows derived from recent projects, scanned projects, and session stats,
   with redacted labels and availability.
3. **Workspace Sessions / Conversations**: per-workspace session/conversation rows, active/highlighted
   refs, archived/pinned labels where already known, and safe empty/error/unavailable states.
4. **Conversation Detail / Results**: one session/conversation, final-answer records separate from
   progress, persisted delivery state, and artifact descriptors where known.
5. **Contextual Runtime Status**: compact and detailed runtime health/progress as supporting context,
   not the landing-page purpose.
6. **Setup / Readiness Guardrails**: declared/configured/observed/UX-exposed capability rows,
   auth/binding status, exposure posture, and missing gates.

No first-lane page should expose task boxes, approval/answer controls, interrupt controls, upload
widgets, switch/resume controls, raw terminal output, raw logs, raw payloads, raw paths, or public Web
support wording.

## 3. Exact Source Surfaces Inspected

### Core vocabulary and semantic view contracts

- `src/core/domain/common.ts`: session status, failure reason, runtime notice type, pending interaction
  kind/state, terminal result kind, terminal delivery state.
- `src/core/domain/context.ts`: session display context, session presentation context, interaction ref,
  terminal result refs.
- `src/core/domain/records.ts`: persisted interaction and terminal-result record shape.
- `src/core/domain/binding.ts`: neutral platform user/chat/binding refs and platform resolution.
- `src/core/interaction-model/runtime.ts`: runtime status card, inspect, hub, command-entry, and
  controls view fields.
- `src/core/interaction-model/interaction.ts`: approval/question/resolved/expired card fields.
- `src/core/interaction-model/terminal.ts`: terminal-result delivery and recent-output entry fields.
- `src/core/interaction-model/media.ts`: media descriptor and resolved asset fields; includes unsafe
  `localPath` that must not cross the Web boundary.
- `src/core/workflow/runtime-workflow.ts`: visible runtime state, blocked reason, status card, inspect,
  rollback, and preferences reducers.
- `src/core/workflow/interaction-workflow.ts`: normalized interaction to surface card reducer.
- `src/core/workflow/terminal-workflow.ts`: final-answer/plan-result delivery and recent-output reducers.
- `src/core/workflow/interaction-support.ts`: safe summaries for answered interactions and permission
  prompts.

### Store facade and persisted records

- `src/state/store.ts`: public `BridgeStateStore` facade, including auth, sessions, runtime notices,
  current session cards, terminal/final-answer views, pending interactions, turn input sources, and
  readiness snapshot methods.
- `src/state/store-records.ts`: auth, binding, session, recent project, scan cache, and session-project
  stat row mappings.
- `src/state/store-sessions.ts`: session/project read methods and sorting for `listSessions`,
  `getActiveSession`, `listSessionsWithThreads`, `listRecentProjects`, `listProjectScanCache`, and
  `listSessionProjectStats`.
- `src/state/store-pending-interactions.ts`: interaction rows, prompt/response JSON persistence,
  unresolved/by-chat/by-turn read methods, and terminal states.
- `src/state/store-runtime-artifacts.ts`: runtime notices, current session cards, terminal/final-answer
  views, turn input source, and readiness snapshot persistence.
- `src/state/store-auth.ts`: authorized user, pending authorization, and chat binding reads.
- `src/types.ts`: row and snapshot field definitions used by the public store facade.

### Current orchestration/runtime evidence

- `src/service/session-project-coordinator.ts`: current active session, status, where, session list,
  project picker, archive/rename/pin semantics, and path-label rendering evidence. Use as behavior
  evidence only; do not import Telegram UI methods for Web view models.
- `src/service/project-browser-coordinator.ts`: current browse and file-preview behavior. Treat as
  forbidden first-lane evidence because it reads local directories/files and carries absolute paths.
- `src/service/current-session-card-controller.ts`: current active-session presentation sync evidence.
- `src/service/runtime-surface-controller.ts`: live runtime hub/status/inspect/final-answer rendering
  orchestration and public read getters reachable through dependencies.
- `src/service/runtime-surface-state.ts`: runtime card state, command summaries, throttling, and cleaned
  error-summary helpers.
- `src/service/runtime-surface-trace-sink.ts`: trace log shape; not a Web data source because traces
  may include ids and operational internals.
- `src/activity/tracker.ts` and `src/activity/types.ts`: `getStatus`, `getInspectSnapshot`,
  `getStreamSnapshot`, activity status, inspect snapshot, recent transitions, progress summaries,
  pending/answered interaction summaries, token usage, and collab-agent snapshots.
- `src/service/interaction-broker.ts`: read helpers for pending/answered summaries and lifecycle
  evidence; action handlers are forbidden in the first lane.
- `src/interactions/normalize.ts`: normalized approval, permissions, questionnaire, and elicitation
  fields; required for safe redaction of stored `promptJson`.
- `src/service/turn-coordinator.ts`: active-turn and recent-activity read getters; start/interrupt/server
  request handlers are forbidden in the first lane.
- `src/service/turn-artifacts.ts`: read-mostly final-answer extraction from app-server history;
  useful as fallback evidence, but not the first default because it reaches app-server history and raw
  turns.
- `src/codex/app-server.ts`: read-capable thread list/read/resume methods and many mutating methods;
  Web view-model code must avoid mutators and redact `cwd`/raw turns if optional reads are ever used.
- `src/codex/notification-classifier.ts`: protocol notification classification feeding runtime state;
  do not expose raw notifications or payloads.
- `src/service/app-server-health-guard.ts`: app-server health sampling shape for contextual health only.
- `src/readiness.ts`: readiness probe, persisted snapshot writing, pack checks, shared checks, app-server
  availability, and issues.
- `src/config.ts`, `src/paths.ts`: config/path shapes; useful for knowing what not to expose.
- `src/packs/contract.ts`, `src/packs/registry.ts`, `src/packs/catalog.ts`: active-pack definition,
  capability snapshots, health checks, and supported-pack metadata.

## 4. View Inventory

### 4.1 Web Home

| Candidate source/facade | Fields to adapt | Redaction needs | Current gaps |
|---|---|---|---|
| `BridgeStateStore.listChatBindings()`, `getAuthorizedUser()`, `getChatBinding()` | authorized/bound operator state, active session id per binding | hide platform user ids, chat ids, tenant/resource ids; expose only binding status and optional display label | no Web auth/session binding exists; current binding is platform chat/user oriented |
| `BridgeStateStore.getActiveSession(chatId)`, `listSessions(chatId, { archived: false, limit })` | active session, recent conversations, session id, display name, project display label, status, failure reason, last activity, last turn id/status, archived flag | redact `projectPath`; avoid selected model/reasoning unless explicitly allowed; expose opaque ids | every read currently needs a chat id/binding; Web needs a single-operator binding resolver |
| `BridgeStateStore.listRecentProjects()`, `listSessionProjectStats()` | workspace rows, recent workspace count hints, last-used timestamps, pinned/source labels | redact path, scan root, and home-relative details; use alias/project name as label | stable opaque workspace id must be derived without exposing path; dedupe recent/scan/stat rows |
| `TurnCoordinator.listActiveTurns()`, `getActiveInspectActivity(sessionId)`, `ActivityTracker.getStatus()` | active turn state, latest progress, blocked reason, final-message availability, pending interaction count | summarize progress; no raw command output, terminal stream, or protocol payload | live data is in-memory only; after restart, Web Home must show degraded/unknown for active turn |
| `BridgeStateStore.listFinalAnswerViews(chatId)` | recent final-answer hint, answer id, kind, delivery state, created time, page/preview availability | sanitize Telegram HTML, do not expose message id or action-consumed semantics as controls | stored final answers are presentation-shaped HTML pages, not neutral answer bodies |
| `BridgeStateStore.getReadinessSnapshot()`, `countRuntimeNotices()` | compact readiness/status badge, missing gates, notice count | hide paths, env-derived details, pids unless reduced to health labels | no declared/configured/observed/UX-exposed matrix persisted yet |

### 4.2 Workspaces

| Candidate source/facade | Fields to adapt | Redaction needs | Current gaps |
|---|---|---|---|
| `BridgeStateStore.listRecentProjects()` | workspace id, label from alias/name, pinned, source, last used, last success | never expose `projectPath`; avoid source roots | path-derived stable ids need a salted/opaque mapping strategy |
| `BridgeStateStore.listProjectScanCache()` | discovered workspace candidates, exists flag, confidence, detected marker labels | hide `projectPath` and `scanRoot`; marker names should be bounded and non-sensitive | scan cache may contain stale/missing paths; Web must show unavailable/missing states |
| `BridgeStateStore.listSessionProjectStats()` | session/conversation count and last-used per workspace | hide grouping path; use redacted project labels | grouping by path/name is internal; view model needs dedupe against recent project rows |
| `SessionProjectCoordinator.projectDisplayName()` evidence | display-name precedence: project alias over project name | no path label | method lives in Telegram-oriented coordinator; copy semantics into adapter instead of importing coordinator UI |
| `ProjectBrowserCoordinator` evidence | browse roots and file previews | do not use in first coding task | browse/preview reads filesystem and should stay outside first read-only inventory lane |

### 4.3 Workspace Sessions / Conversations

| Candidate source/facade | Fields to adapt | Redaction needs | Current gaps |
|---|---|---|---|
| `BridgeStateStore.listSessions(chatId, { archived, limit })` | rows with session id, display name, workspace label, status, failure reason, archived state, created/last-used times, last turn id/status | hide `chatId`, `telegramChatId`, `threadId` by default; redact `projectPath`; selected model/reasoning optional only | no direct list-by-workspace public method; adapter must filter/group by internal path without returning it |
| `BridgeStateStore.getActiveSession(chatId)` and `getCurrentSessionCard(chatId)` | active/highlighted refs and last current-card update | hide message id; active ref is not a switch capability | current-session card is Telegram presentation state, not a Web contract |
| `BridgeStateStore.listSessionsWithThreads()` | cross-binding conversation candidates with thread ids | hide thread ids unless needed for internal linking | may cross operator/binding if used blindly; prefer binding-scoped list first |
| `TurnCoordinator.getRecentActivity(sessionId)` | recent completed/live activity for a row | summarize status and final-message availability | in-memory/recent only, may be absent after restart |
| `CodexAppServerClient.listThreads({ cwd })` optional future fallback | app-server conversations by cwd, name, preview, created/updated, status | redact `cwd`; avoid raw status; do not call mutators | requires app-server availability and mapping back to bridge sessions; not first default |

### 4.4 Conversation Detail / Results

| Candidate source/facade | Fields to adapt | Redaction needs | Current gaps |
|---|---|---|---|
| `BridgeStateStore.getSessionById(sessionId)` | conversation/session title, workspace label, status, timestamps, last turn id/status | hide chat/platform ids, thread id, project path, selected model unless approved | direct session id must be authorized against the operator binding before rendering |
| `BridgeStateStore.listFinalAnswerViews(chatId)`, `getFinalAnswerView(answerId, chatId)` | answer id, session/thread/turn linkage, kind, delivery state, created time, preview/pages availability | sanitize `previewHtml` and `pages`; do not expose delivery message id; no Telegram action controls | body is Telegram-rendered HTML pages; no neutral markdown/body store yet |
| `TerminalResultViewRow.pages` and `previewHtml` | final answer body/pages if considered safe | remove links/actions/HTML not allowed by Web sanitizer; mark unavailable if unsafe | no sanitizer/neutral renderer exists for Web |
| `TurnArtifactsFromHistory` and `extractTurnArtifactsFromHistory()` optional fallback | final message, proposed plan, compaction/review fallback metadata | raw app-server turns must not be rendered; avoid raw protocol details | app-server history access may be unavailable/slow; should be fallback, not first-lane dependency |
| `BridgeMediaDescriptor` / `ResolvedMediaAsset` evidence | artifact descriptors, media type, size, availability, expiry, failure reason | never expose `localPath`, temp paths, sha unless intentionally approved; platform refs must be opaque | no generated artifact catalog is persisted beyond terminal answer pages and media descriptors |
| `BridgeStateStore.getTurnInputSource(threadId, turnId)` | voice-input transcript indicator if needed | transcript may be user content; do not show by default on result page | currently only `voice`; not required for first detail/results view |

### 4.5 Contextual Runtime Status

| Candidate source/facade | Fields to adapt | Redaction needs | Current gaps |
|---|---|---|---|
| `TurnCoordinator.listActiveTurns()` | active turn refs: session id, chat id, thread id, turn id, tracker | hide chat/thread/turn ids from user-facing display; retain opaque refs internally | active turns disappear after process restart |
| `TurnCoordinator.getActiveInspectActivity(sessionId)`, `getRecentActivity(sessionId)` | tracker/status card for active/recent sessions | do not expose status-card message id or Telegram reply markup | recent activity is in-memory only |
| `ActivityTracker.getStatus()` | turn status, runtime state, active item type/label, last activity, blocked reason, final-message availability, error state | summarize labels; no raw terminal chunks; token usage optional and bounded | canonical Web vocabulary must map `idle/starting/running/blocked/interrupted/completed/failed/unknown` to Web status labels |
| `ActivityTracker.getInspectSnapshot()` | recent transitions, command/file/MCP/web summaries, plan/proposed plan, agents, completed commentary, pending/answered interactions | bounded summaries only; no raw diffs, raw command output, stack traces, protocol payloads, or full token accounting by default | inspect snapshot is rich and easy to overexpose; adapter needs a strict allowlist |
| `runtime-workflow.ts`, `terminal-workflow.ts` reducers | visible state, blocked reason, recent-output and final-result separation | do not pass HTML directly without Web sanitizer | reducers are surface-oriented but not Web-ready DTOs |
| `BridgeStateStore.listRuntimeNotices(chatId)`, `countRuntimeNotices()` | restart/app-server/deferred-delivery notices | sanitize HTML/message; hide reply markup | notice messages are presentation-shaped |
| `AppServerHealthGuard` and readiness snapshot | app-server health/availability label | hide pid/details unless reduced | health guard does not persist rich health history for Web |

### 4.6 Setup / Readiness Guardrails

| Candidate source/facade | Fields to adapt | Redaction needs | Current gaps |
|---|---|---|---|
| `BridgeStateStore.getReadinessSnapshot()` | state, checked time, active pack, codex/app-server booleans, pack/shared checks, issues, setup checklist | redact `codexBinResolvedPath`, `voiceFfmpegResolvedPath`, raw pack metadata, env names when sensitive, pids, path-like values | snapshot is operational readiness, not declared/configured/observed/UX-exposed matrix |
| `readiness.ts` probe output | configured/observed health details and issue categories | expose summaries only | probe can start/probe app-server; Web view model should read persisted snapshot first |
| `StoreAuth.getAuthorizedUser()`, `listChatBindings()`, `listPendingAuthorizations()` | auth/binding configured and operator binding status | no platform user id, chat id, username unless owner-approved display label | Web auth is not implemented; existing auth is pack-specific |
| `BridgePackDefinition.capabilities`, `PackHealthReport` | declared pack capabilities, health checks, setup state | missing env names may be sensitive; show capability labels, not secrets | Web itself has no pack definition or capability row yet |
| `config.ts` and `paths.ts` | know which config/path fields must be blocked | do not render raw env/config/path values | no redaction helper exists yet |

## 5. Recommended First Code Seam

Add the first read-only view-model adapter at the bridge service/read-model boundary, not in Telegram,
Feishu, or a future route layer.

Recommended file shape for the first coding task:

- `src/service/web-readonly-view-model.ts`
- `src/service/web-readonly-view-model.test.ts`

Recommended exported seam:

- a pure-ish factory such as `createWebReadonlyViewModelProvider(deps)`;
- methods such as `getHomeViewModel()`, `listWorkspaceViewModels()`,
  `listWorkspaceConversationViewModels(workspaceId)`, `getConversationResultViewModel(sessionId)`,
  `getRuntimeContextViewModel()`, and `getReadinessGuardrailViewModel()`;
- dependencies injected as read-only facades: `getStore()`, `getReadinessSnapshot()`, optional
  `listActiveTurns()`, optional `getActiveInspectActivity(sessionId)`, optional
  `getRecentActivity(sessionId)`, optional pack/capability provider, and clock/id-redaction helpers.

Why this seam:

- it composes persisted store rows plus in-memory runtime state, which neither Core-only types nor Web
  routes should own;
- it lets routes/components stay dumb and read-only later;
- it allows unit tests without starting a Web server, Telegram poller, Feishu runtime, or app-server;
- it centralizes redaction before page rendering;
- it avoids copying Telegram UI HTML/button behavior into Web contracts;
- it can return explicit unavailable/degraded states while the backing runtime source is absent.

Do not add task submission, approval answers, interrupt, upload, switch/resume, archive, rename, pin,
project browse, file preview, app-server mutators, Web auth, routes, client components, or persistent
schema changes in this first seam.

## 6. Data That Must Not Be Read Or Exposed

The first Web view-model adapter must not read or expose by default:

- tokens, API keys, OAuth secrets, bot tokens, cookies, session ids, raw env values, tunnel credentials,
  or provider debug blobs;
- raw `projectPath`, `scanRoot`, `cwd`, home-directory paths, temp paths, socket paths, config paths,
  DB paths, log paths, artifact backing paths, or resolved binary paths;
- `chatId`, `telegramChatId`, Feishu chat/open ids, platform resource ids, callback ids, message ids,
  reply markup, or tenant identifiers as user-visible fields;
- raw terminal streams, command-entry controls, shell prompts, unbounded command output, raw diffs,
  verbose logs, stack traces, request headers, app-server protocol payloads, or notification dumps;
- raw `promptJson` / `responseJson` without normalized interaction redaction;
- secret questionnaire answers or hidden answer values;
- arbitrary project file contents, directory listings, file previews, or upload/download handles unless a
  later explicit artifact-preview gate approves them;
- Web support/supportability claims.

The adapter may internally read rows containing paths or ids only when needed for grouping or lookup,
but it must convert them to opaque ids and redacted labels before returning a view model.

## 7. Remaining Gap List After First Adapter

1. **Web auth/binding is still not implemented.** Existing auth is platform chat/user binding. The
   adapter uses an injected authorized-operator context and must fail closed when no binding is
   available.
2. **Workspace ids are path-backed today.** Recent projects, scan cache, and session stats all key by
   path. Web needs stable opaque ids and redacted labels.
3. **No direct list-sessions-by-workspace facade.** The adapter must group/filter sessions internally or
   a later store read method must be added after review.
4. **Final answers are stored as Telegram-oriented HTML pages.** Web can render safe availability and
   sanitized content only after an allowlist/sanitizer decision; otherwise body should be unavailable.
5. **Gap3 artifact catalog/descriptors is next.** There is no neutral generated-artifact descriptor
   catalog with retention and availability states; keep the next slice descriptor-only and read-only,
   with no downloads, uploads, routes, UI, auth, servers, writes, or action controls.
6. **Runtime live state is in memory.** Active/recent activity from `TurnCoordinator` and
   `ActivityTracker` is lost after restart; persisted sessions/notices/final answers must carry the
   degraded fallback.
7. **Interaction rows store raw JSON.** They need normalization and a strict redaction allowlist before
   Web display, especially for secret questionnaire fields and permission details.
8. **Readiness is not yet a four-level matrix.** Persisted readiness describes operational state; the Web
   setup page needs declared/configured/observed/UX-exposed rows derived by the adapter.
9. **App-server read methods expose raw cwd/status/turns.** Optional thread reads must be isolated,
   bounded, timeout-protected, redacted, and kept out of the first default path.
10. **No Web route/component skeleton exists.** That is intentional; the landed view-model seam and
    tests do not add routes.

## 8. Landed First Adapter Task And Next Safe Item

The first read-only view-model adapter and tests have landed. Gap1 final-answer/workspace redaction
and Gap2 pending-interactions read model have also landed. The next safe implementation item after
closeout is Gap3 neutral artifact catalog/descriptors, still read-only and without routes, UI, auth,
servers, writes, downloads, uploads, or action controls.

Allowed source files for the landed first adapter task were:

- `src/service/web-readonly-view-model.ts` (new)
- `src/service/web-readonly-view-model.test.ts` (new)
- `src/service/AGENTS.md` only if a local router exists and must mention the new owner file
- `docs/plans/2026-04-26-web-viewmodel-inventory.md` only for follow-up notes

The first slice kept shared type aliases in the adapter file rather than adding a larger architecture.

Forbidden files and areas for the first coding task:

- no `src/telegram/**` or `src/feishu/**` UI changes;
- no `src/packs/**` runtime changes;
- no `src/codex/app-server.ts` mutator changes;
- no `src/state/**` schema or write-method changes;
- no `src/service/turn-coordinator.ts` action/start/interrupt changes;
- no project browser/file-preview code;
- no Web server, route, client component, CSS, auth middleware, proxy, tunnel, upload, task-submit,
  approval-answer, interrupt, switch/resume, archive, rename, or pin implementation.

Minimum first adapter behavior preserved by tests:

- return safe empty/unavailable states when store, binding, readiness, or runtime data is absent;
- derive workspace rows from recent projects and session stats without returning paths;
- derive conversation rows from binding-scoped sessions without returning platform ids or paths;
- derive conversation detail from session rows and persisted final-answer rows, marking unsafe bodies
  unavailable until sanitized;
- derive runtime context from injected active/recent activity getters, with strict allowlisted fields;
- derive readiness guardrails from persisted snapshot plus injected declared capability rows;
- include tests that assert raw paths, chat ids, message ids, prompt JSON, and action fields are not
  present in returned view models.

## 9. Verification Expectations For Follow-Up Work

Read-only Web view-model follow-up work should run at minimum:

```sh
git diff --check
npm run check
node --import tsx --test src/service/web-readonly-view-model.test.ts
```

Recommended test coverage:

- empty store/unbound operator returns denied or unavailable state without bridge data;
- workspace rows redact project paths and scan roots;
- conversation rows redact chat ids, thread ids, and project paths;
- final-answer rows expose delivery/availability but not Telegram message ids or action controls;
- runtime rows expose status/progress summaries but not raw command output, terminal text, or reply markup;
- interaction rows expose normalized state/title/summary only and hide secret answer values;
- readiness rows hide resolved binary paths, pids, env values, and pack credentials;
- serialized view models do not contain representative forbidden substrings from fixtures.

Manual review before any later Web UI work:

- inspect the adapter DTO names and ensure they describe Web Home, workspaces, conversations,
  conversation results, runtime context, and readiness guardrails;
- confirm there are no imports from Telegram/Feishu UI rendering modules;
- confirm no app-server mutator method is called;
- confirm Web remains prototype-only in docs and comments.

Closeout status: the first adapter, Gap1, and Gap2 are landed; Gap3 artifact catalog/descriptors is
the next safe read-only implementation item after documentation hygiene.
