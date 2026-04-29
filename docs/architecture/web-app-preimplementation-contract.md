<!-- docmeta
role: leaf
layer: 3
parent: docs/architecture/README.md
children: []
summary: pre-implementation Core/state/API contracts and readiness gates for future Web/App Codex Console surfaces
read_when:
  - before starting any Web/App prototype or implementation for Codex Console
  - the request needs neutral Core/state/API contracts for future Web/App work
  - the request needs readiness gates before Web/App can be called supported
skip_when:
  - the request is about current Telegram or Feishu shipped behavior
  - the request is asking for Web/App source code, routes, components, handlers, or transport plumbing
source_of_truth:
  - docs/architecture/web-app-preimplementation-contract.md
  - docs/architecture/platform-capability-matrix.md
  - docs/future/web-app-control-surface-sketch.md
-->

# Web/App Pre-Implementation Contract

Status: Pre-implementation contract for future design only
Owner: Architecture / Product
Last updated: 2026-04-26

This document is the contract-pass output for the future Web/App Codex Console surface.
It defines the neutral Core, state, and API-surface meanings that a future Web/App prototype
must use before any source-code implementation begins.

It does **not** claim current Web/App support. Telegram remains the stable first/default pack.
Feishu remains a serious current pack with explicit setup and readiness caveats. Compatibility
names stay unchanged: repository/package `telegram-codex-bridge`, CLI `ctb`, and existing
service, config, state, and environment paths.

## Purpose

A future Web/App surface must be a native control surface over shared Codex Bridge Core
semantics, not a fake chat pack and not a parallel product. This contract exists to keep
future implementation work small and reviewable by defining:

- the shared product meanings Web/App must consume or expose;
- the boundary between Core, Presentation, Pack, and Web/App-owned transport/storage/layout;
- readiness gates that must pass before Web/App can be called supported;
- non-goals and guardrails that prevent overclaiming current capability.

## Contract Vocabulary

Use these neutral terms in future Web/App implementation and docs:

| Term | Contract meaning |
|---|---|
| **Control surface** | The authorized operator-facing UI, regardless of platform. It may be a chat, panel, page, app shell, or native window. |
| **Project** | A selectable workspace/root known to the bridge. The contract covers selection and browsing, not future project write operations. |
| **Session** | A durable conversation/workflow context associated with a project and operator binding. |
| **Turn** | One submitted task or continuation, with lifecycle state and timestamps. |
| **Interaction** | A Core-requested operator response such as an approval, question, picker choice, pagination action, or recovery decision. |
| **Runtime status** | Current and recent workflow health, progress, blocked state, inspect detail, and degraded/recovered state. |
| **Final answer** | The completed assistant answer, separate from transient progress, logs, recent output, and delivery status. |
| **Artifact** | A generated or referenced file/image/result that can be previewed, downloaded, or linked through platform-owned handles. |
| **Delivery outcome** | The result of attempting to render or deliver a Core event/result to a control surface. |
| **Readiness level** | One of declared, configured, observed, or UX-exposed capability for a required baseline journey. |

## Ownership Boundaries

| Layer | Owns | Must not own |
|---|---|---|
| **Core** | Project/session meaning, turn lifecycle, interaction models, runtime status, final-answer meaning, artifact descriptors, delivery-outcome semantics. | Web routes, component layout, browser/app storage, WebSocket/SSE plumbing, cookies, push subscriptions, CSS, Telegram buttons, Feishu card JSON. |
| **Presentation** | Mapping neutral state and interactions into surface-specific views such as panels, forms, modals, drawers, cards, pages, or streams. | Product workflow state machines, platform credentials, transport sessions, persistent browser/app secrets. |
| **Pack** | Platform identity, ingress/egress adaptation, auth binding, health checks, dynamic tools, platform resource handles, setup probes. | Shared Codex workflow semantics or Web/App page layout. |
| **Web/App transport/storage/layout** | Routes/pages, client state, live transport, cookies/session security, browser/app storage, upload widgets, responsive layout, notifications, previews. | Core-owned workflow decisions or support claims before readiness gates pass. |

Future Web/App code may introduce internal APIs, but those APIs must carry these neutral
meanings instead of leaking chat-message ids, Feishu card ids, browser component ids, upload
tokens, or local temp paths into Core contracts.

## Project And Session Surface Contract

A future Web/App prototype must use a neutral project/session surface with these meanings:

- list selectable projects with stable ids, display labels, path/workspace metadata where allowed,
  and unavailable/empty/error states;
- list recent sessions with stable ids, project association, title/summary where available, last
  activity, archived/pinned state where supported, and continuation eligibility;
- read the active project and session for the authorized control surface;
- start a new session, resume an existing session, and switch active project/session through Core-owned
  workflow rules;
- expose archive, unarchive, rename, and pin only where the current product semantics support them;
- separate read-only browsing/history from any future project write operation.

The contract outcome is a Web/App view model that can render dashboards, sidebars, history lists,
and empty-state panels without assuming chat chronology or platform message ids.

## Turn Lifecycle Contract

A future Web/App turn surface must represent canonical lifecycle transitions:

1. **draft** — operator is composing input or structured fields locally;
2. **submitted** — the control surface has accepted a task for Core processing;
3. **queued** — the task is waiting for runtime capacity or app-server availability;
4. **running** — the turn is actively executing;
5. **blocked** — Core requires an interaction response before continuing;
6. **interrupting** — an operator stop/interrupt request has been accepted;
7. **done** — final answer and artifact descriptors are available;
8. **failed** — the turn ended without a final answer;
9. **recovered** — runtime restart/recovery restored a known state or produced a degraded outcome.

Each turn state must include a stable turn id, session id, project id, state, creation/update
timestamps, optional active interaction id, optional progress summary, and terminal outcome when
known. Web/App may show these as timelines, cards, live streams, or detail panels, but it must not
invent a parallel lifecycle outside Core semantics.

## Runtime Status And Progress Contract

Runtime status must be available as two neutral shapes:

- **compact status** for badges, headers, lists, and quick health indicators;
- **detailed status** for inspect panels, diagnostics pages, recent-output views, and recovery guidance.

The minimum status vocabulary is: idle, queued, running, blocked, interrupting, done, failed,
degraded, unhealthy, and recovered. Detailed status may include active turn/session, recent output,
last event time, app-server health, pending interaction count, delivery warnings, and recovery notes.

Progress is not final answer content. Web/App must render progress as live or refreshable runtime
state and keep it visually separate from terminal answers and artifacts.

## Interaction Contract

Core-facing interactions must be neutral models. Web/App Presentation decides whether to render
them as forms, modals, drawers, inline panels, command-palette prompts, or paginated lists.

Required interaction families:

- **approval** — approve/reject/modify a proposed action with risk text and optional details;
- **question** — answer a free-form or constrained prompt;
- **picker** — choose one or more options from projects, sessions, models, files, tools, skills,
  apps, plugins, accounts, or other enumerated resources;
- **pagination/navigation** — request next/previous page, expand/collapse, open detail, or return;
- **recovery notice** — acknowledge or choose a recovery path after stale, duplicate, failed, or
  degraded workflow events.

Each interaction must carry a stable interaction id, family/type, title, body/details, options or
fields where applicable, validation rules, expiry/staleness metadata, source turn/session ids, and
terminal response outcome. Required outcomes are resolved, rejected, expired, stale, duplicate,
failed, canceled, and superseded.

## Final Answer And Artifact Contract

Final answers must be modeled separately from progress and delivery attempts.

A final-answer record should include a stable answer id, turn id, session id, project id, content
summary or body, creation time, rendering hints, artifact descriptors, and delivery outcomes. It
must support long-form rendering through pages, panels, preview panes, search, or history, not by
requiring chat-style message splitting as the primary UX.

Artifact descriptors must include neutral metadata such as artifact id, label, media type, size
when known, previewability, source turn/session, retention hint, and a pack/Web/App-owned handle for
preview or download. Core must not depend on a browser blob URL, upload token, platform file id, or
local temp path as the artifact meaning.

## Delivery And Degraded-Outcome Contract

Delivery is a first-class state, not an implementation detail to hide.

Required delivery outcomes:

- created — a new surface element/page/card/panel entry was created;
- updated — an existing element was updated;
- deferred — delivery is pending or will retry;
- partially delivered — some content or artifacts reached the surface, but not all;
- failed — delivery did not reach the surface;
- rate-limited — delivery was delayed or reduced by platform limits;
- fallback — the surface used an alternate page/file/download/history entry;
- degraded — the user-visible result is available with known limitations.

Web/App must expose degraded and failed outcomes in status panels, final-answer views, notifications,
or recovery notices. It must not silently truncate, drop artifacts, hide stale interactions, or treat
transport success as product success.

## Media And Attachment Descriptor Contract

User-supplied media and generated artifacts must cross the Core boundary through descriptors.

Minimum attachment descriptor fields:

- attachment id;
- kind: text, image, file, audio, remote-url, or future explicit extension;
- display name and media type where known;
- byte size/dimensions/duration where known;
- readiness: pending, available, rejected, failed, expired;
- validation errors or warnings;
- source: upload, picker, paste, drag/drop, platform message, generated artifact, or remote URL;
- opaque platform/Web/App-owned resource handle.

Web/App owns browser/app file pickers, drag/drop, paste, upload progress, previews, permission
errors, chunking, and resumable upload mechanics. Core owns only the normalized descriptor and
whether the descriptor is valid for the requested workflow.

## Auth, Binding, And Readiness Contract

Web/App must keep the current high-trust operator model unless a separate future product decision
changes it. The pre-implementation contract is single-operator/control-surface binding, not team or
multi-tenant collaboration.

Required auth/binding meanings:

- identify the authorized operator/control surface without assuming Telegram chat ids or Feishu tenant ids;
- bind sessions and runtime actions to that authorized surface;
- reject unauthorized or unbound access before task submission or interaction response;
- expose setup and health gaps in an admin/setup view;
- preserve pack-specific credentials and security controls outside Core.

Readiness must be reported separately for each required capability:

1. **Declared** — the future surface declares it can support the capability.
2. **Configured** — required server/app settings, local storage, credentials, app-server connection,
   media paths, and security controls are present.
3. **Observed** — the running system has successfully seen ingress, interaction response, live/update
   delivery, upload/download where configured, interrupt, final-answer delivery, and recovery/degraded paths.
4. **UX-exposed** — an operator can reach the capability through pages, panels, forms, buttons,
   menus, setup screens, or documented fallbacks.

## Minimum Acceptance Gates Before Support Claim

Do not call Web/App a supported Codex Console surface until all gates below pass through UX-exposed
journeys with documented fallback behavior:

- authorized operator can complete setup/binding and see readiness status;
- operator can choose or confirm a project and session;
- operator can submit a text task and see queued/running/blocked/done/failed transitions;
- operator can answer at least one approval/question interaction and see resolved/expired/stale states;
- operator can inspect runtime status, progress, recent output, and app-server health;
- operator can interrupt an active turn and see the outcome;
- operator can receive a final answer separately from progress;
- operator can preview or download at least baseline artifacts/files when configured;
- degraded delivery, rate limits, stale/duplicate responses, upload failure, app-server recovery, and
  final-answer fallback are visible and actionable;
- capability readiness is tracked as declared, configured, observed, and UX-exposed, not as a
  single boolean;
- implementation reuses Core workflow semantics and does not fork Telegram or Feishu behavior into a
  hidden Web-only product path.

## Non-Goals

This contract does not define or authorize:

- Web/App source implementation, routes, components, CSS, API handlers, websocket/SSE servers, native
  app bridges, or deployment topology;
- a public network API or hosted control plane;
- current Web/App support claims;
- repo/package, CLI, service, config, state, or environment-variable renames;
- multi-user collaboration, team permissions, provider setup, raw terminal access, project write
  operations, or remote administration;
- replacing Telegram as the stable/default pack or demoting Feishu as a serious current pack;
- treating Telegram callback payloads, Feishu card schemas, or Web component ids as Core data.

## Overclaim Guardrails

Use this language discipline in future docs and release notes:

- say **future Web/App surface**, **prototype**, or **pre-implementation contract** until readiness gates pass;
- do not say Web/App is supported, shipped, enabled, or available unless the minimum acceptance gates
  are verified;
- keep Telegram and Feishu current behavior separate from Web/App target capability rows;
- describe Web/App affordances as panels, forms, modals, pages, live streams, previews, uploads, and
  admin/setup screens rather than copied chat flows;
- treat protocol capability and static UI design as insufficient evidence of product support;
- require a support-decision update before changing user-facing support claims.

## First Prototype Preconditions

Before a future coding task starts, the implementation plan should name:

- the Core surfaces it will read or adapt for project/session, turns, runtime, interactions, final
  answers, artifacts, and readiness;
- the Web/App transport choice and fallback for live or refreshable updates;
- the storage/security boundary for operator sessions, CSRF/session controls, uploads, previews, and
  notifications;
- the explicit subset of acceptance gates targeted by the prototype;
- which current Telegram/Feishu lessons are evidence versus which platform details are intentionally
  kept out of the Web/App design.
