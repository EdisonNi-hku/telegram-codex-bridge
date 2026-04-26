<!-- docmeta
role: leaf
layer: 3
parent: docs/operations/README.md
children: []
summary: future Web prototype VPS/mobile validation, protected URL exposure, access-control, and shutdown plan
read_when:
  - planning owner validation for the future Web-first Codex Console prototype from a VPS
  - deciding when screenshots are enough versus when a protected phone-accessible URL may be exposed
  - reviewing security gates, forbidden data, or rollback for the future Web prototype
skip_when:
  - the request is about current Telegram or Feishu shipped behavior
  - the request is asking for Web server, auth, proxy, tunnel, route, or networking implementation
source_of_truth:
  - docs/operations/web-vps-mobile-access-and-security.md
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/architecture/web-app-preimplementation-contract.md
-->

# Web VPS Mobile Access And Security Plan

Status: Future Web prototype validation plan only
Owner: Product / Operations / Security
Last updated: 2026-04-26

This plan defines how the owner should validate a future **Web-first Codex Console** prototype that
runs on an owner-controlled VPS Linux server and is normally inspected from a phone. The Web product
shape being validated is workspace/session/conversation centric: Web Home, workspace sessions, and
conversation results first; runtime, readiness, and access state as supporting context. It is not an
implementation plan and does not authorize Web routes, servers, auth middleware, proxy config,
tunnels, scripts, networking changes, public support claims, or native App work.

Web remains a future/prototype surface. Telegram remains the current stable/default pack. Feishu
remains a serious current pack with explicit setup and readiness caveats.

## Assumptions

- The prototype runtime is on a VPS Linux server controlled by the owner.
- The owner normally validates from a phone, not by opening a browser on the VPS itself.
- Early validation evidence should be captured by the controller as screenshots or recordings.
- A phone-accessible URL is allowed only after login, access control, and forbidden-data guardrails
  are ready.
- The first Web MVP lane is single-operator, read-mostly, non-public, and prototype only.
- The first lane must not include raw terminal access, arbitrary project writes, upload flow, or
  action controls. Action controls are later-lane work only after separate review and approval.

## Validation Phases

| Phase | Purpose | Allowed exposure | Exit gate |
|---|---|---|---|
| 1. Controller screenshots/recordings | Validate information architecture, state coverage, and mobile-sized layout without giving the owner a live URL. | Controller-only local or tunneled access; no owner-facing URL required. | Owner can review captured mobile-sized evidence and identify missing/confusing states. |
| 2. Protected URL readiness | Prove the prototype can reject unauthorized access and hide sensitive data before a phone trial. | Reversible, temporary, authenticated, and preferably allowlisted access. | Login/access control, operator binding, forbidden-data checks, and shutdown path are verified. |
| 3. Read-only phone trial | Let the owner open the protected URL from a phone and inspect baseline read-only flows. | Protected URL for the owner only. | Owner can read Web Home, workspace sessions, conversation results/artifacts, runtime context, interactions, readiness, and degraded states from phone. |
| 4. Controlled actions later | Add one approved action class at a time after security/readiness review. | Protected URL with action-specific controls. | The specific action has CSRF/action protection, audit trail, stale/failure handling, and rollback visibility. |

Do not skip directly from phase 1 to action controls. Do not expose any unauthenticated Web Home or
state page during any phase.

## Exposure Patterns To Consider

These are patterns to evaluate before implementation, not instructions to configure them now.

| Pattern | Good fit | Main risks | Required guardrails |
|---|---|---|---|
| SSH tunnel for controller-only screenshot capture | Phase 1 evidence collection where only the controller needs browser access. | Not usable by the owner from phone unless additional access is created; can hide mobile-network issues. | Keep access local to the controller session; capture mobile-sized screenshots/recordings; tear down after evidence capture. |
| Reverse proxy with authentication | Phase 2 or 3 owner phone trial when a stable protected URL is needed. | Misconfigured auth, broad public exposure, weak session handling, leaked headers/logs. | Enforce auth before the app; use HTTPS; bind to the single operator; prefer allowlisting where practical; log minimal metadata. |
| Temporary tunnel such as cloudflared/ngrok-style access | Short-lived phone trial when DNS/proxy setup is not ready. | Accidental public reachability, stale tunnel left running, provider account/config leakage. | Use temporary URLs only; require auth at the app or tunnel layer; set an expiry; stop the tunnel immediately after trial. |
| VPN/Tailscale-style private access | Owner-only trials where installing or using a private network from phone is acceptable. | Device enrollment friction, stale device access, unclear ownership of network policy. | Restrict to owner devices; remove trial devices when done; still require app login before showing state. |
| IP allowlist where possible | Extra defense for known owner/controller networks. | Mobile networks change; allowlist alone is not authentication. | Treat as defense-in-depth only; combine with login; keep a documented emergency remove/deny rule. |

## Recommended Default For First External Owner Trial

Use a **protected URL behind authentication with a reversible exposure mechanism**, and prefer an IP
allowlist or private-network restriction where practical. For the first external owner trial, the
recommended default is:

1. finish phase 1 with controller-captured mobile-sized screenshots/recordings;
2. expose a short-lived protected URL for the owner-only read-only phone trial;
3. require login before rendering any Web Home or state;
4. disable the exposure immediately after the trial unless a follow-up review explicitly keeps it on.

A reverse proxy with authentication is the steadier default if the owner will repeat phone trials.
A temporary tunnel is acceptable for a short one-off trial only when it is authenticated, time-bound,
and easy to shut down. VPN/Tailscale-style access is acceptable when the owner prefers private-device
access over a public internet URL.

## Login And Access-Control Requirements

Before any exposed URL exists, the prototype must satisfy all of these requirements:

- unauthenticated requests see no Web Home, workspace/session state, runtime state, final answers,
  artifacts, readiness details, logs, local paths, or terminal-like output;
- only the intended high-trust operator can authenticate;
- authenticated access is bound to the owner/operator context, not to anonymous browser state;
- sessions expire or can be revoked without changing application code;
- logout or revoke removes access from the phone browser;
- access denial is safe and generic, without revealing projects, paths, tokens, provider names, or
  local configuration details;
- CSRF/action protection is present before any state-changing route, even if action buttons are not
  yet visible;
- auth and exposure settings are visible in the setup/readiness view as configured/observed status,
  without printing secrets.

## Forbidden Data By Default

The future Web prototype must not render these by default:

- tokens, API keys, OAuth secrets, bot tokens, tunnel credentials, cookies, session ids, or raw env
  values;
- full local sensitive paths, home-directory paths, temp paths, socket paths, raw artifact backing
  paths, or config-file locations unless intentionally redacted;
- raw terminal, shell prompt, command-entry controls, or unbounded command output;
- verbose logs, stack traces, request headers, full payload dumps, provider debug blobs, or app-server
  protocol dumps;
- arbitrary project file contents or diffs outside an explicitly approved read-only preview path;
- upload widgets, file write controls, project mutation controls, or action controls before their
  separate gate passes.

Preferred defaults are redacted labels, stable opaque ids, summarized status, safe artifact
descriptors, and explicit unavailable/expired/failure states.

## Mobile UX Acceptance Checklist

A protected phone trial passes only when the owner can validate all required read-only flows from a
normal phone viewport:

- login works from the phone, and unauthenticated access is rejected;
- Web Home workspace/session status is readable without horizontal scrolling;
- active project/session, recent session, and empty/error/unavailable states are understandable;
- runtime states such as idle, queued, running, blocked, done, failed, degraded, unhealthy, and
  recovered are visually distinct;
- progress/recent output is clearly separate from final answers;
- final answers are readable as long-form content, not only as transient progress;
- artifact rows show safe availability, preview/download eligibility, unavailable, expired, and
  failure states without leaking local paths;
- interaction states show pending, resolved, expired, stale, duplicate, and failed outcomes even
  while response actions remain disabled;
- readiness shows declared/configured/observed/UX-exposed status and the next missing gate;
- error, degraded, and recovery messages are understandable on a phone;
- no raw secrets, sensitive local paths, raw terminal controls, verbose logs, uploads, or write
  actions appear by default.

## Go/No-Go Gates For Exposing A URL

| Gate | Go | No-go |
|---|---|---|
| Scope | Web-first, App-later, read-mostly prototype scope is still intact. | First trial includes raw terminal, uploads, arbitrary writes, action controls, or public support wording. |
| Screenshot evidence | Controller screenshots/recordings show baseline pages and mobile-sized states. | Owner cannot evaluate the prototype before live exposure, or key states are missing. |
| Authentication | Login is required before any state renders, and unauthorized access is rejected. | Any Web Home/state page is reachable without auth. |
| Operator binding | Access is limited to the intended high-trust operator. | Access is anonymous, shared, or not revocable. |
| Forbidden data | Secrets, raw env, sensitive paths, terminal, verbose logs, and unsafe artifacts are absent or redacted. | Any secret/path/log/terminal leak appears in the UI or default error path. |
| Exposure control | The selected exposure is temporary or reversible, with allowlist/private access where practical. | Nobody can quickly identify or stop the exposure. |
| Read-only posture | The URL exposes read-only pages only. | Browser can submit tasks, answer interactions, interrupt, upload, or write without separate action approval. |
| Shutdown drill | The owner/controller knows the exact stop path and expected result. | Rollback requires code changes, searching for process ids blindly, or waiting on a third party. |

## Incident And Rollback Plan

If the URL, auth, tunnel, proxy, or UI exposes more than intended, treat it as a stop-the-trial event.
The rollback path must be known before exposure starts.

Immediate actions:

1. disable the external exposure path first, before debugging the UI;
2. stop or remove the temporary tunnel, proxy route, DNS mapping, allowlist entry, or private-network
   share used for the trial;
3. revoke sessions or invalidate auth credentials used for the trial;
4. rotate any token or secret that may have been displayed, logged, copied, or included in a
   screenshot/recording;
5. preserve only redacted evidence needed for root-cause review;
6. record the incident in the readiness/security notes with date, impact, exposure window, data
   class involved, rollback completed, and follow-up gate.

A trial may resume only after the leaked data class is removed or redacted, unauthorized access is
retested, and the owner approves the next gate.

## Decisions Required Before Implementation

Before any coding, proxy, auth, tunnel, or networking task starts, decide:

- which phase is being implemented or validated;
- who is the single authorized operator for the first trial;
- which authentication mechanism and session revocation path will be used;
- whether the first owner URL uses reverse proxy, temporary tunnel, VPN/private network, allowlist,
  or a combination;
- whether the URL will be temporary by default and what event shuts it down;
- what evidence the controller must capture before live URL exposure;
- what forbidden-data redaction rules apply to paths, artifacts, logs, errors, and readiness details;
- which mobile browsers/viewports are accepted for the first read-only trial;
- which action classes remain disabled and what separate gate would enable each one;
- who can declare no-go, execute rollback, and approve resuming the trial.
