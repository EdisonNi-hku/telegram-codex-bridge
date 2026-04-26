<!-- docmeta
role: leaf
layer: 3
parent: docs/future/README.md
children: []
summary: approved Web-first Codex Console MVP scope, readiness model, validation path, and support-claim guardrails
read_when:
  - planning the first Web Codex Console MVP
  - deciding what the Web MVP may claim, show, or defer
  - preparing VPS/mobile validation, readiness evidence, or support go/no-go review
skip_when:
  - the request is about current Telegram or Feishu shipped behavior
  - the request is asking for Web routes, components, API handlers, or implementation code
source_of_truth:
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/plans/2026-04-26-web-mvp-controller-triage.md
  - docs/architecture/web-app-preimplementation-contract.md
-->

# Web MVP Scope And Readiness

Status: Approved Web-first MVP scope, future prototype only
Owner: Product / Architecture
Last updated: 2026-04-26

This document lands the approved first-lane scope for a **Web-first Codex Console MVP** and the
readiness model required before any Web support claim. The product direction is a
workspace/session/conversation-centric Web app, similar in spirit to T3 Chat, Code Web, or the Codex
app: users start from workspaces, inspect each workspace's conversations, and open conversation
results. It is not a generic management dashboard or admin console. This is a planning and
validation contract, not an implementation plan. It does not authorize Web routes, components, API
handlers, native App work, public support claims, or repository/package/CLI/service/environment
renames.

## Decision

Codex Console should validate **Web first, App later**.

- Web is the first future control-surface target because the owner runs the service on VPS Linux and
  validates from a phone.
- App remains alive, but deferred until Web proves the shared Codex Bridge Core path and support
  readiness model.
- The first Web lane is **read-mostly**, **single-operator**, **non-public**, and **prototype only**.
- Early owner validation uses screenshots and recordings. A protected URL comes only after login and
  access control are ready.

## Current Support Truth

| Surface | Current truth | Product wording |
|---|---|---|
| Telegram | Current stable/default surface. | Supported/default pack for current shipped behavior. |
| Feishu | Serious current pack with setup, permission, callback, and readiness caveats. | Current pack that needs explicit readiness validation. |
| Web | Future prototype only; no current support claim. | Web-first MVP target after readiness gates. |
| App | Future and alive, but later. | Deferred until Web proves the shared contract path. |

Do not describe Web as shipped, supported, enabled, generally available, or a replacement for
Telegram/Feishu until the support go/no-go gates in this document pass.

## MVP Goal

The first Web MVP should prove that a browser can consume shared Codex Bridge Core semantics without
forking Telegram or Feishu behavior. It should orient the owner around workspaces, sessions, and
conversation results from a phone: workspace list, active workspace, per-workspace conversations,
conversation detail, final answers, and artifacts. Runtime/status, readiness, and access state are
contextual information and setup gates around that experience, not the whole product.

## Approved First-Lane Pages

| Page | First-lane content | First-lane posture |
|---|---|---|
| Web Home | Workspace list, active workspace/session summary, recent conversations, compact runtime and readiness badges, degraded warnings. | Read-only after auth; landing page, not an admin dashboard. |
| Workspace Sessions | Active workspace/session, per-workspace conversation list, recent sessions, empty/error/unavailable states. | Read-only first; open details only, no switch/resume control. |
| Conversation Detail / Results | Conversation/session detail, final answer separated from progress, artifact descriptors and safe availability, preview, or download states. | Preview/download only where configured and safe. |
| Runtime | Idle, queued, running, blocked, done, failed, degraded, unhealthy, recovered; compact and detailed status; recent output summary. | Contextual status only; no raw terminal. |
| Interactions | Pending, resolved, expired, stale, duplicate, and failed states tied to their source conversation/session. | Read-only first. |
| Setup / Readiness | Declared/configured/observed/UX-exposed matrix, auth/access status, capability gaps. | Setup gate before exposure decisions, not primary UX. |

## Explicit Deferred Scope

Deferred does not mean canceled. These items are outside the first Web MVP lane:

- native App implementation;
- public Web support claim;
- multi-user/team collaboration;
- raw terminal or shell controls;
- arbitrary project writes/file editing;
- full upload flow;
- browser/mobile push notifications;
- hosted/SaaS control plane or public network API;
- provider/admin console expansion beyond narrow setup/readiness gaps;
- repo/package/CLI/service/config/state/environment-variable renames;
- replacing Telegram as the current default surface or demoting Feishu as a serious current pack.

## Action Gates

| Action | First-lane decision | Gate before enabling |
|---|---|---|
| View Web Home, workspace sessions, conversation history/results, status, artifacts, and readiness | Approved after auth | Login/access control works and unauthorized access is rejected. |
| Switch or resume project/session | Deferred | Owner approves action audit, active-context semantics, failure visibility, and recovery behavior. |
| Submit a text task | Deferred | CSRF/action protection, lifecycle visibility, failure visibility, and audit trail exist. |
| Answer approval/question | Deferred | Stale, duplicate, expiry, failure, and resolved outcomes are visible. |
| Interrupt | Deferred | Action audit trail, interrupt outcome, degraded/recovery state, and owner warning copy are visible. |
| Upload files | Deferred | Attachment validation, storage, retention, size/type limits, and security posture are approved. |

The first implementation package must remain read-mostly. Action gates are later-lane gates only;
task submission, approval/question response, interrupt, upload, switch/resume, and write controls
must not enter the first Web MVP lane.

## Readiness Model

Readiness is a matrix, not a boolean. Each baseline capability reports four levels:

| Level | Meaning | Evidence |
|---|---|---|
| Declared | The capability is included in the approved Web MVP target. | Scope row and readiness row exist. |
| Configured | Required config, process, storage, auth, handles, and app-server connection exist. | Setup/readiness page or operator checklist. |
| Observed | A real run exercised the path successfully or produced an understood degraded outcome. | Timestamped run note, screenshot, recording, or status evidence. |
| UX-exposed | The owner can use or inspect the capability in the Web UI or a documented fallback. | Reachable page, panel, state, form, action, or fallback. |

## Baseline Capability Rows

| Capability | MVP target | Minimum gate |
|---|---|---|
| Login/access control | Required before any URL exposure. | No exposed unauthenticated Web Home or workspace state. |
| Operator binding | Required before state or action display. | Authorized control surface is clear; unbound access is rejected. |
| Workspace/session/conversation visibility | Required for screenshot prototype. | Workspace list, active workspace, recent conversations, and empty/error/unavailable cases render safely. |
| Runtime status visibility | Required for screenshot prototype. | Running/blocked/done/failed/degraded states are understandable. |
| Final answer visibility | Required for Web usefulness. | Final answer is visually separate from progress/recent output. |
| Artifact/file visibility | Required where configured. | Descriptor, unavailable, expired, failure, preview, or download state is visible. |
| Interaction visibility | Required before action controls. | Pending/resolved/expired/stale/duplicate/failed states are visible. |
| Delivery/degraded outcome visibility | Required before support claim. | Partial, failed, rate-limited, fallback, and degraded outcomes are visible. |
| Mobile URL validation | Required before owner acceptance of protected URL. | Owner opens authenticated URL from phone and validates baseline read-only flows. |
| Screenshot/recording evidence path | Required before protected URL trial. | Owner can review captured evidence without public exposure. |

Action capabilities such as interaction response, text task submission, interrupt, and upload are
tracked separately after their gates are approved; they are not part of the first read-mostly lane.

## VPS And Mobile Validation Plan

The owner-operated validation sequence is mandatory:

1. **Local VPS run with screenshots/recordings.** Validate information architecture and mobile-sized
   layouts without exposing a URL.
2. **Protected URL only after login/access control exists.** Use temporary, reversible, allowlisted,
   or otherwise controlled exposure.
3. **Owner phone validation of read-only flows.** Confirm Web Home, workspace sessions, conversation detail/results, runtime context, artifact, readiness, and degraded states are readable from a phone.
4. **Controlled actions only after security/readiness approval.** Enable one action class at a time
   only after the relevant gate passes.

Minimum protected-phone acceptance:

| Check | Pass condition |
|---|---|
| Login | Owner signs in from phone; unauthenticated access is rejected. |
| Web Home | Workspace list, active workspace/session, recent conversations, current turn, and contextual readiness/status are readable. |
| Runtime | Running/blocked/done/failed/degraded state is clear without horizontal scrolling. |
| Final answer | Completed answer is readable separately from progress. |
| Artifacts | Artifact availability or unavailability is understandable. |
| Security | No raw secrets, local sensitive paths, raw terminal controls, or verbose logs are exposed by default. |

## Security And Access Guardrails

Security blocks exposure. If login, authorization, or action protection is missing, the prototype may
be reviewed only through screenshots/recordings.

| Guardrail | Required posture |
|---|---|
| Authentication | Mandatory before any external URL exposure. |
| Authorization | Single high-trust operator binding for MVP; reject unbound access. |
| Network exposure | No unauthenticated public URL; prefer temporary, reversible, allowlisted, or proxied access. |
| Session security | Use server-side sessions or equivalent; avoid durable browser secrets beyond need. |
| CSRF/action protection | Required before task submission, interaction responses, interrupt, or upload. |
| Secrets | Do not display tokens, env vars, raw credentials, or sensitive config values. |
| Paths/logs | Avoid raw local paths and verbose logs by default; expose diagnostics only intentionally. |
| Terminal | No raw terminal or shell controls in the first Web lane. |
| Writes | No arbitrary project writes in the first Web lane. |
| Artifacts | Use controlled handles; show expired/unavailable/failure states safely. |
| Auditability | Record visible outcomes for every enabled action and failure path. |
| Failure visibility | Failed, degraded, rate-limited, and fallback outcomes must be shown, not hidden. |

## Owner Go/No-Go Gates

| Gate | Go condition | No-go condition |
|---|---|---|
| Scope lock | Owner accepts Web-first/App-later, read-mostly first lane, and deferred scope. | App-first, public support, raw terminal, uploads, or writes enter the first lane. |
| Screenshot prototype | Owner can understand the pages from screenshots/recordings on phone-sized views. | Key states are missing, confusing, or expose sensitive details. |
| Protected URL | Login/access control and forbidden-data guardrails are configured. | Any unauthenticated Web Home/state page, secret/path/log leak, or unclear operator binding. |
| Phone read-only trial | Owner validates read-only Web Home, workspace sessions, conversation detail/results, runtime context, artifact, readiness, and degraded states. | Baseline flows cannot be inspected from phone. |
| Controlled action trial | A single approved action class has CSRF/action protection, audit trail, stale/failure handling, and recovery visibility. | Actions would mutate runtime state without clear outcome and recovery visibility. |
| Support claim | Required baseline journeys are declared, configured, observed, and UX-exposed, with documented fallbacks. | Any required baseline remains only designed, only configured, or only internally observable. |

Minimum support claim also requires the owner to authenticate, confirm project/session, submit a text
task, answer at least one approval/question, inspect progress, interrupt when needed, receive the
final answer, access baseline artifacts where configured, and understand degraded/failure states
through Web UI or documented fallback.

## Status And Reporting Format

Each Web MVP status update should be short and evidence-based:

```text
WEB_MVP_PHASE: Scope | Screenshot | Protected URL | Read-only phone | Controlled action | Support decision
STATUS: Green | Yellow | Red
DATE:
ENVIRONMENT: local VPS | protected URL | phone browser
SUMMARY:
READINESS CHANGES:
- Capability: declared/configured/observed/UX-exposed delta and evidence
SECURITY NOTES:
OWNER EVIDENCE: screenshot/recording/status link or note
BLOCKERS:
NEXT GATE:
```

Use Green only when the current phase gate passed with evidence. Use Yellow for useful progress with
known gaps. Use Red for a security, readiness, or scope issue that prevents the next exposure level.
