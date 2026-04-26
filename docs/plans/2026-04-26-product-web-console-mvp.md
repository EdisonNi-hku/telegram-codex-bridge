<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: Phase 3 Product Web Console MVP information architecture, core flows, acceptance criteria, and next implementation slices
read_when:
  - starting Phase 3 Product Web Console MVP work
  - deciding whether a Web change is product UI, substrate, action, or support-claim scope
  - preparing the first real Console shell/readable conversation detail implementation slice
skip_when:
  - the task is only about current Telegram or Feishu shipped behavior
  - the task is implementing runtime code without needing Product Web Console scope
source_of_truth:
  - docs/plans/2026-04-26-product-web-console-mvp.md
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/architecture/web-app-preimplementation-contract.md
-->

# Product Web Console MVP — Phase 3 First Slice

Status: Phase 3 docs/planning landing; no runtime implementation in this slice
Owner: Product / Architecture
Last updated: 2026-04-26

## Current Correction

The current browser preview is an owner-visible temporary read-only debug/admin preview. It is useful proof that a browser can reach sanitized Bridge state, but it is not a user-facing Web product, not public, and not supported Web Console behavior.

Phase 3 shifts the lane from substrate/security plumbing toward a real Product Web Console MVP: Web first, App later; single high-trust operator first; owner/private; denied-by-default; read-mostly until the read experience is useful.

## Product Goal

The MVP should let the owner open a browser on phone or desktop and immediately answer:

- What is my Codex Bridge doing right now?
- Which workspaces/projects and conversations/tasks exist?
- Which conversation or task is running, blocked, done, failed, or degraded?
- What was the final useful result, shown in a readable Web layout?
- What needs my attention, without exposing raw platform internals or unsafe controls?

A usable Web Console is not a debug portal. It should feel like a workspace/conversation/task product surface: clear navigation, readable details, human status copy, safe degraded states, and mobile-first result reading. Runtime, readiness, and access information support the product experience; they are not the product by themselves.

## MVP Navigation And Information Architecture

### 1. Home

Purpose: fast orientation.

Content:

- Product header: `Codex Console` plus environment label such as `Owner preview` or `Read-only prototype`.
- Compact system state cards:
  - current runtime state: idle, running, blocked, degraded, failed, or unavailable;
  - pending attention count: approvals/questions needing review, shown read-only in this lane;
  - readiness summary: ready, degraded, setup needed, or unavailable.
- Active workspace/project card, if known: safe label, last activity, active conversation/task summary.
- Recent conversations/tasks list: title or safe summary, workspace label, state, last update, and link to detail.
- Empty/degraded states when data is absent: explain what is unavailable and what the owner can still do.

Must not show raw chat IDs, session IDs, local paths, tokens, callback payloads, terminal logs, or platform-shaped copy.

### 2. Workspaces / Projects

Purpose: browse safe workspace context without changing runtime state.

Content:

- Workspace/project rows with safe display label, optional redacted/relative metadata where approved, last activity, conversation count if available, and readiness hints.
- Active workspace marker if known.
- Per-workspace entry points to conversations/tasks.
- Safe unavailable state when the workspace reader is missing, unbound, filtered, or degraded.

First lane behavior: read-only browse and open only. No project switching, renaming, pinning, archiving, writes, file browsing, or raw path reveal.

### 3. Conversations / Tasks

Purpose: give the owner a scannable work queue/history.

Content:

- Unified rows for sessions/conversations/tasks using Web-neutral labels.
- State badge: running, blocked, pending input, pending approval, done, failed, degraded, or unavailable.
- Short safe summary, workspace/project label, last update, and final-answer availability.
- Attention grouping: `Needs attention`, `Running now`, `Recently completed`, `Older` when data supports it.
- Empty state that distinguishes no conversations from data unavailable.

First lane behavior: open detail only. No submit-new-task, resume, interrupt, approval answer, question answer, raw logs, downloads, or platform message links.

### 4. Conversation / Task Detail

Purpose: make the result readable and separate final output from progress/debug state.

Content:

- Header: title/safe summary, workspace label, state badge, timestamps where available, and read-only/action-disabled posture.
- Status panel: current lifecycle state in user language, including running/blocked/pending/degraded explanation.
- Final answer panel:
  - render sanitized Web-neutral final answer body when present;
  - show a clear unavailable/degraded message when no safe body source exists;
  - keep progress, runtime output, delivery warnings, and final answer visually separate.
- Pending interaction panel: approval/question/picker read-only summary when present, including state and expiry/stale wording when known.
- Artifacts panel: descriptor-only labels and availability states; no raw paths or unsafe downloads in this first slice.
- Runtime/delivery notes: concise degraded/failed/fallback messages, not terminal dumps.

### 5. Pending / Approvals

Purpose: show what needs owner attention before action controls are enabled.

Content:

- Pending approval/question/picker cards grouped by conversation/task.
- Risk/title/body summary sanitized for Web.
- State: pending, resolved, expired, stale, duplicate, failed, or unavailable.
- Expiry or last update when available.
- Disabled or absent action controls in the read-only MVP; copy should say actions are not enabled in this preview.

This page is the handoff point for the later gated action lane, but this first slice only specifies the read view.

### 6. Runtime / Readiness / Settings

Purpose: explain whether the Console is safe and useful right now.

Content:

- Runtime compact and detailed state: idle, queued, running, blocked, interrupting, done, failed, degraded, unhealthy, recovered, or unavailable.
- Readiness matrix for baseline capabilities: declared, configured, observed, UX-exposed.
- Access posture: owner/private, authenticated/denied-by-default, active binding known or unavailable.
- Setup gaps and degraded reasons in safe language.
- Kill-switch/rollback readiness may be listed as status only; no live destructive controls in this MVP slice.

This area must not become the primary landing page or a generic admin dashboard.

## Core Flows

### Flow A — Open Console And Understand State Quickly

1. Owner opens the protected Console on phone or desktop.
2. Unauthorized access is denied before state is shown.
3. Home loads with clear owner-preview/read-only posture.
4. Owner sees runtime state, pending-attention count, active workspace, and recent conversations/tasks above the fold.
5. If state is unavailable, the page explains the degraded source instead of showing empty debug tables.

Acceptance:

- The owner can tell within one screen whether the system is idle, running, blocked, degraded, or unavailable.
- Mobile layout works without horizontal scrolling.
- No raw IDs, paths, tokens, callback data, or platform-specific terms are required to understand the page.

### Flow B — Browse Workspace / Session / Task Rows Safely

1. Owner opens Workspaces/Projects or Conversations/Tasks.
2. Rows use safe labels and human states.
3. Owner can filter mentally by attention/running/recent groupings where present.
4. Empty and degraded states distinguish `nothing here` from `data source unavailable`.
5. Owner opens a detail page through an opaque Web handle.

Acceptance:

- Rows are cards or responsive list items, not table-only debug dumps.
- Opaque handles may exist in URLs but are not presented as meaningful user content.
- No row includes raw platform IDs, local absolute paths, tokens, or terminal output.

### Flow C — Open Conversation / Task Detail And Read Status / Result

1. Owner opens a conversation/task detail page.
2. Header identifies the work using safe summary, workspace label, and state.
3. Final answer appears as readable Web content when a safe source exists.
4. If the final answer body is absent, the page says it is unavailable because no sanitized Web body source exists.
5. Pending state, artifacts, runtime notes, and degraded delivery are separate panels.

Acceptance:

- Final answer is not confused with progress, recent output, or delivery status.
- Long text wraps and is readable on phone.
- Detail page never scrapes Telegram HTML, Feishu card JSON, callback markup, or debug pages as body content.

### Flow D — See Running / Blocked / Pending States In User Language

1. Owner sees a running task as `Running` with a short explanation such as `Codex is working; results will appear here when complete.`
2. Owner sees a pending question as `Needs answer` with the question summary and read-only action-disabled copy.
3. Owner sees a pending approval as `Approval needed` with safe risk text and read-only action-disabled copy.
4. Owner sees degraded runtime as `Status degraded` with the missing source or stale data caveat.

Acceptance:

- The page uses owner-language state labels, not raw app-server event names or internal enum dumps.
- Pending states are visible before any action lane is enabled.
- Degraded runtime is explicit and safe; it does not look like a successful idle state.

### Flow E — Later Gated Action Lane Handoff

The first action lane comes after read UX is useful and protected owner access/action guardrails are accepted. Candidate first actions are:

1. approval/question answer first; or
2. submit draft first, only if explicitly chosen later.

This MVP spec does not choose or implement an action. It defines the handoff requirements:

- visible pending/readiness state exists before enabling controls;
- owner auth/session binding is confirmed;
- CSRF/replay protection or equivalent exists;
- action nonce/idempotency and audit exist;
- stale, duplicate, expired, failed, canceled, and resolved outcomes are visible;
- kill switch and rollback drill are verified;
- no action silently mutates runtime state without an owner-visible outcome.

## Readable UI Acceptance Criteria

- Mobile-first: primary flows work at phone width without horizontal scrolling, tiny tap targets, or table-only layouts.
- Desktop-friendly: wide screens may add sidebars/panels but cannot hide key state behind debug tables.
- Accessible static HTML baseline: semantic headings, landmarks or clear sections, readable focus order, sufficient contrast, escaped content, and usable no-JavaScript fallback for read views.
- Product language: use Web-neutral terms such as workspace, project, conversation, task, result, runtime, pending, approval, question, readiness.
- No Telegram-shaped or Feishu-shaped copy in Web UI, except when explicitly naming a configured platform in a safe settings/readiness context.
- No raw internals: do not show raw IDs, local paths, tokens, env vars, callback payloads, platform message IDs, app-server JSON, stack traces, or raw terminal output.
- No debug feel: cards, sections, readable prose, badges, and empty states should replace table-only pages as the primary UX.
- Safe stale data: timestamps or copy should make stale/degraded data clear when known.
- Read-only posture: disabled/absent controls should not invite actions that are not enabled.

## Data And Source Contract For Final Answer / Body Rendering

Final answer body rendering is allowed only from Web-neutral sanitized sources owned by the bridge/Core/Web view-model boundary.

Allowed source examples:

- sanitized final-answer body already exposed by the Web read model;
- persisted neutral final-answer record created for Web/Core consumption;
- sanitized plain text or safe markdown produced by a bridge-owned final-answer pipeline;
- artifact descriptors that point to availability state, not raw files, when body is unavailable.

Forbidden body sources:

- Telegram message HTML, Telegram callback markup, Telegram message IDs, or Telegram-rendered pages;
- Feishu card JSON, Feishu event payloads, or platform callback/action payloads;
- browser debug/admin pages or scraped prototype HTML;
- raw terminal output, logs, app-server protocol dumps, local filesystem paths, or secret-bearing config;
- tokenized download URLs or platform resource handles treated as body text.

If no safe Web-neutral body exists, the detail page must render an explicit unavailable/degraded state, for example:

- `Final answer body unavailable: this run has no sanitized Web-readable answer source yet.`
- `Result metadata is available, but the answer text was not captured in a Web-safe format.`

It must not silently fall back to scraping a chat transcript or debug preview.

## Runtime And Pending State Acceptance Copy

Required user-language states:

- `Idle` — no active task is known.
- `Queued` — a task is waiting to start.
- `Running` — Codex is working; result will appear when complete.
- `Needs answer` — Codex asked a question; action is read-only until the action lane is enabled.
- `Approval needed` — Codex requested approval; action is read-only until the action lane is enabled.
- `Blocked` — progress is stopped until a required owner interaction is resolved.
- `Done` — final result or completion metadata is available.
- `Failed` — the task ended without a usable final answer.
- `Degraded` — state is partial, stale, or missing a source; the visible data may be incomplete.
- `Unavailable` — the required reader/source is not connected or not authorized.
- `Recovered` — runtime restarted or state was restored with known caveats.

Acceptance:

- Running state includes what is happening and where the owner should look next.
- Pending question/approval states are prominent on Home, list rows, detail, and Pending/Approvals.
- Degraded runtime names the missing class of source without leaking internals.
- Failed/unavailable states provide safe next-step copy such as refresh, check readiness, or use the current Telegram/Feishu fallback if applicable; they do not imply Web support is complete.

## Guardrails And Non-Goals

Guardrails:

- Web is not shipped, public, supported, or product-complete.
- First lane remains single-operator, owner/private, denied-by-default, and read-mostly.
- Protected access must exist before owner URL exposure; screenshots/recordings remain acceptable proof before that.
- Web UI must consume neutral Core/bridge view models, not fork Telegram or Feishu UI semantics.
- Platform-specific credentials, tokens, local secret files, raw app-server payloads, and callback data stay out of UI and docs.
- Readiness is a matrix, not a boolean support claim.
- Action controls require a separate explicit implementation gate.

Non-goals for this MVP lane:

- native App work;
- public hosted service or SaaS control plane;
- multi-user/team collaboration;
- submit-new-task, approval answer, question answer, interrupt, upload, project switching, session resume, or file/project writes;
- raw terminal, shell, log console, arbitrary command execution, or debug protocol explorer;
- artifact download/preview unless a later slice explicitly supplies safe handles and retention rules;
- repo/package/binary/config/state renames;
- replacing Telegram as the current stable/default surface or overstating Feishu/Web support.

## Implementation Slices After This Spec

Order matters: the immediate next code slice should deliver the first real Console shell/readable conversation detail UI, not more substrate-only work.

1. **Console shell and readable conversation detail UI**
   - Convert the existing read-only HTML into a mobile-first Console shell with Home navigation, safe badges, readable cards, and conversation/task detail layout.
   - Use existing safe view-model fields only.
   - Preserve token/auth gate and opaque handles.
   - Tests: static render assertions for nav, mobile-friendly structure classes/sections, escaped content, no raw IDs/paths/tokens, and unavailable final-answer copy.

2. **Final-answer body source refinement**
   - Wire only existing sanitized Web-neutral final-answer body where present.
   - Add explicit unavailable/degraded rendering when absent.
   - Tests: present body renders escaped/readable; absent source never scrapes Telegram/Feishu/debug HTML.

3. **Conversation/task list grouping and state language**
   - Add user-language groups and state labels for running, blocked, pending question, pending approval, done, failed, degraded, unavailable.
   - Tests: all canonical states render safe copy and no platform enum leaks.

4. **Pending/Approvals read-only page or section**
   - Surface pending interactions as read-only cards linked to source conversation/task.
   - Tests: pending/resolved/expired/stale/duplicate/failed states render; no action submission endpoints or controls are active.

5. **Runtime/readiness/settings read page**
   - Render compact and detailed runtime/readiness matrix in safe owner language.
   - Tests: degraded/unavailable runtime copy, denied-by-default posture, no secrets/paths/log dumps.

6. **Owner proof package**
   - Produce screenshot/HTML proof from local/protected owner preview after readable UI lands.
   - Tests/smoke: unauthenticated denial, authenticated Home/detail, mobile-sized screenshot, token/path/raw ID absence.

7. **First gated action decision doc/update**
   - Choose approval/question answer first or submit draft first only after read UX and proof pass.
   - No implementation until security/action gates are accepted.

## Verification Plan

This docs slice:

- `git diff --check` must pass.
- `npm run check` must pass.
- If router/catalog links are updated, run the cheapest available catalog/link check; otherwise note not applicable.

Future code slices:

- targeted unit tests around view-model rendering and HTTP route output;
- static HTML assertions for semantic sections, escaped content, state copy, unavailable/degraded copy, and forbidden internals;
- smoke test unauthenticated denial and authenticated Home/detail;
- mobile-width screenshot proof before owner review;
- regression proof that no action endpoints, downloads, uploads, raw terminal, platform callback markup, or support claims were added.

## Acceptance Checklist For Phase 3 MVP Scope

This spec is complete when it defines:

- owner/user product goal beyond debug portal;
- concrete Home, Workspaces/Projects, Conversations/Tasks, Detail, Pending/Approvals, Runtime/Readiness/Settings IA;
- core read flows and later action-lane handoff;
- readable UI acceptance criteria;
- safe final-answer/body source contract;
- runtime and pending state acceptance copy;
- explicit guardrails and non-goals;
- ordered small implementation slices with the first real UI slice next;
- verification plan for docs now and code/smoke/screenshot proof later.
