<!-- docmeta
role: leaf
layer: 3
parent: docs/future/README.md
children: []
summary: future design sketch for a richer Web/App Codex Console control surface powered by Codex Bridge Core
read_when:
  - the request is about a future Web or App control surface for Codex Console
  - the request needs Web/App-specific Core, Presentation, Pack, readiness, or sequencing implications
skip_when:
  - the request is about current Telegram or Feishu shipped behavior
  - the request is asking for Web/App implementation details or source code
source_of_truth:
  - docs/future/web-app-control-surface-sketch.md
  - docs/architecture/web-app-preimplementation-contract.md
  - docs/future/multi-platform-core-prd.md
  - docs/architecture/platform-capability-matrix.md
-->

# Web/App Control Surface Sketch

Status: Future design sketch, not implementation commitment
Owner: Product / Architecture
Last updated: 2026-04-26

This sketch describes how a future Web or App surface for **Codex Console** could use
**Codex Bridge Core** without becoming a fake chat pack or a generic admin dashboard. The preferred
product shape is workspace/session/conversation centric: start from workspaces, inspect a
workspace's conversations, and open or resume a conversation when the relevant action gates exist.
It is forward-looking only: Telegram remains the stable/default pack, Feishu is a serious current
pack, and Web/App support is not claimed by this document.

## Goal

Define a Web/App control surface direction that:

- reuses shared Core semantics for projects, sessions, turns, interactions, runtime state,
  final answers, artifacts, and delivery outcomes
- presents those semantics through native Web/App affordances such as Web Home, Workspace Home,
  conversation/session lists, result detail pages, contextual panels, forms, modals, durable history,
  file pickers, uploads, and live updates
- keeps platform-specific transport, credentials, layout, browser/app storage, and notification
  behavior out of Core
- makes readiness measurable before any user-facing claim that Web/App is supported

## Non-Goals

This sketch does not:

- implement Web/App source code, routes, components, API handlers, or transport
- claim current Web/App product support
- replace Telegram or Feishu as current packs
- copy Telegram chat UX into a browser or app shell
- expand scope into multi-user collaboration, provider setup, raw terminal access, project write
  operations, generic admin dashboards, or team permissions unless those are chosen as explicit future decisions
- make browser, desktop, and mobile app packaging decisions

## Core Reuse Target

A Web/App surface should call into the same product meaning used by current packs, not fork
workflow logic behind a richer UI.

| Shared meaning | Web/App reuse target |
|---|---|
| Project/session lifecycle | Show active project and session, start/resume/switch sessions, expose empty/error states, and keep a durable session timeline. |
| Turn lifecycle | Start a turn, continue a blocked turn, interrupt safely, and render queued/running/blocked/done/failed transitions. |
| Interactions | Render approvals, questions, pickers, and structured prompts as forms or modals with resolved/expired/failed states. |
| Runtime visibility | Show status, progress, recent output, inspect detail, and health in panels rather than transient chat messages. |
| Final answers and artifacts | Preserve final answers separately from progress, attach generated files/images where available, and provide history/search/navigation. |
| Delivery outcomes | Represent sent, updated, deferred, failed, rate-limited, and degraded delivery without hiding partial results. |
| Media and attachments | Normalize user-supplied images/files/audio descriptors before Core workflow use, while leaving upload/download handles platform-owned. |
| Auth, binding, readiness | Bind one authorized operator/control surface, report ready/awaiting/unhealthy, and separate declared/configured/observed/UX-exposed readiness. |

## Core, State, And API Surfaces To Expose Or Stabilize

The contract pass for these surfaces now lives in `../architecture/web-app-preimplementation-contract.md`.
That document is the required pre-implementation artifact for neutral Core/state/API meanings,
ownership boundaries, and readiness gates. The sketch below remains future design context, not
a current support claim or public network API shape.

1. **Project/session surface**
   - list selectable projects and recent sessions
   - read active project/session and session metadata
   - start, resume, switch, archive/unarchive, rename, and pin where the product supports it
   - distinguish read-only browse/history from future project write operations

2. **Turn lifecycle surface**
   - submit a new text or structured task
   - continue a blocked turn with a validated interaction response
   - interrupt/stop an active turn
   - expose canonical state transitions and timestamps

3. **Runtime status surface**
   - expose running, blocked, idle, degraded, unhealthy, failed, and recovered states
   - provide compact status for badges and detailed status for panels
   - avoid requiring chat-message ids to understand runtime progress

4. **Interaction surface**
   - describe approvals, questions, selections, pagination, and recovery notices as neutral models
   - include expiry, stale-response, duplicate-response, and failure outcomes
   - let Presentation choose forms, modals, drawers, or inline panels

5. **Artifacts and final-answer surface**
   - separate final answer, transient progress, logs/recent output, generated artifacts, and file references
   - support long-form rendering without chat splitting as the primary UX
   - expose downloadable or previewable artifacts through platform-owned media handles

6. **Delivery and degraded-outcome surface**
   - return delivery results that distinguish created, updated, deferred, failed, partially delivered,
     rate-limited, and fallback-to-file/page outcomes
   - keep degraded outcomes visible in the UI instead of silently failing or truncating

7. **Media and attachment surface**
   - accept normalized attachment descriptors for images, files, and future audio/remote URLs
   - keep local temp paths, platform resource ids, upload tokens, and download URLs out of shared Core meaning
   - provide size/type/readiness validation before a turn begins

8. **Auth, binding, and readiness surface**
   - bind the authorized operator/control surface without assuming Telegram chat ids or Feishu tenant ids
   - expose readiness levels: declared, configured, observed, and UX-exposed
   - report setup gaps and health checks in terms a Web/App setup or readiness page can render

## Pack And Presentation Responsibilities

Web/App should be a richer native surface. The Pack/Presentation layer owns how Core state is
reached, rendered, and delivered.

| Area | Web/App responsibility |
|---|---|
| Routes | Define pages for Web Home, Workspace Home, workspace sessions/conversations, conversation results, runtime context, interactions, artifacts, settings, and setup/readiness. |
| Workspace/session panels | Render active workspace/session, conversation list/detail, running turn, blocked interactions, recent output, inspect/status detail, and degraded notices. |
| Forms/modals | Collect approvals, questionnaire answers, project/session choices, setup inputs, and destructive-action confirmations. |
| Live transport | Use Web/App-appropriate push such as WebSocket, SSE, native app bridge, or polling fallback; Core should not own transport plumbing. |
| Notifications | Map Core notices to browser/app badges, toasts, native notifications, and unread counters with user-controlled settings. |
| File picker/uploads | Own browser/app file selection, upload progress, previews, local permission errors, and conversion into neutral attachment descriptors. |
| Setup/readiness pages | Render access status, pack readiness, app-server health, MCP/tooling state, diagnostics, and repair guidance without making setup the primary UX. |
| Layout/navigation | Choose sidebars, tabs, responsive panels, command palette, and history views without forcing chat chronology. |
| Platform storage | Own cookies, browser/app storage, push subscription ids, CSRF/session mechanisms, and platform-specific security controls. |

## Readiness Gates Before Claiming Web/App Support

Do not advertise Web/App as a supported Codex Console surface until every baseline journey has
at least fallback support and each required capability has crossed the right readiness level.

1. **Declared capability**
   - Web/App declares baseline text input, interactions, live or refreshable updates, final-answer
     delivery, media/file handling, auth binding, setup/health, and degraded-state rendering.

2. **Configured capability**
   - required server, local app, credentials, storage, app-server connection, and media/temp paths
     are present and validated.
   - notification and upload features report their own enabled/disabled status instead of hiding gaps.

3. **Observed capability**
   - the surface has successfully observed task ingress, interaction response, live/update delivery,
     upload/download where configured, final-answer rendering, interrupt, and recovery/degraded paths.

4. **UX-exposed capability**
   - users can reach the complete journey through routes, panels, menus, forms, buttons, or setup pages,
     not only by invoking internal APIs.

Minimum support claim requires an operator to authorize, choose or confirm a project/session,
submit a task, answer an interaction, inspect progress, interrupt when needed, receive the final
answer, and understand any degraded or failed delivery state.

## Migration Path From Telegram And Feishu Lessons

Use the current packs as evidence, not templates to copy.

1. **Preserve Core meaning that already generalized well.** Project/session selection, turn start,
   blocked-turn continuation, runtime status, final-answer delivery, and degraded outcomes should stay
   shared.
2. **Retire chat-specific assumptions at the boundary.** Telegram message ids, callback payloads,
   inline button layouts, Feishu card JSON, tenant tokens, and upload handles remain pack-owned.
3. **Promote interaction models, not rendered controls.** Telegram callbacks and Feishu card actions
   both imply neutral approvals/questions/selections; Web/App should render those as forms and modals.
4. **Make readiness first-class.** Feishu showed that declared capability is not enough when scopes,
   callbacks, uploads, or observed events are missing. Web/App should expose setup and observed health
   directly.
5. **Exploit richer surfaces carefully.** Web/App can provide dense inspect panels, history,
   previews, and admin pages, but those features must call shared workflow/state contracts instead of
   creating a parallel product.

## Open Decisions

These decisions are intentionally not made by this sketch:

- Browser-only Web, desktop app, mobile app, or shared shell first?
- Local-only access, reverse proxy, remote access, or hosted control plane?
- Authentication model beyond the current high-trust single-operator assumption?
- Live transport choice: WebSocket, SSE, native app bridge, polling fallback, or a layered mix?
- Artifact storage and retention policy for final answers, uploads, previews, and generated files?
- Notification model and opt-in requirements for browser/app/native notifications?
- Whether Web/App should introduce multi-user collaboration, provider setup, raw terminal views,
  project write operations, or team permissions as separate future tracks?
- Which Core surfaces should become stable internal APIs versus documented external APIs?

## Sequencing

A safe sequence is:

1. **Contract pass** — complete in `../architecture/web-app-preimplementation-contract.md`; use it
   as the required pre-implementation contract before any Web/App source work.
2. **Readiness model pass** — make declared/configured/observed/UX-exposed readiness reportable for
   every required Web/App baseline capability.
3. **Prototype shell** — build a non-public Web/App shell that reads status, project/session, runtime,
   interaction, and final-answer state through Core contracts.
4. **Interaction and media pass** — add forms/modals and file picker/upload flows through neutral
   interaction and attachment descriptors.
5. **Degraded/recovery pass** — verify failure, stale interaction, duplicate response, rate limit,
   upload failure, interrupted turn, and app-server recovery paths.
6. **Support decision** — only after the baseline journey is configured, observed, UX-exposed, and
   documented, decide whether Web/App becomes a supported Codex Console surface.
