<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: protected owner-only access design gate for the local token-gated read-only Web prototype, including threat model, auth/session requirements, rollback drill, and acceptance checklist
read_when:
  - planning the first owner phone/browser access trial for the Web read-only prototype
  - deciding whether localhost-only Web may be exposed beyond the controller machine
  - checking protected-access threat model, auth/session gates, rollback, or acceptance criteria
skip_when:
  - the task is only about current Telegram or Feishu shipped behavior
  - the task needs source implementation details for Web server, auth middleware, proxy, tunnel, or networking
source_of_truth:
  - docs/plans/2026-04-26-web-protected-owner-access-plan.md
  - docs/operations/web-vps-mobile-access-and-security.md
  - docs/plans/2026-04-26-web-first-pm-ledger.md
-->

# Web Protected Owner Access Plan

Status: design gate complete; docs-only phase; not runtime exposure  
Owner: Hermes/Tuzi controller; Codex runs are implementation/review subagents  
Last updated: 2026-04-26

## Decision Summary

This phase defines a future safe path from the current localhost-only Web prototype to an owner-only
phone/browser preview. It does **not** make Web public, shipped, generally supported, mobile-ready, or
action-capable.

Current ground truth stays unchanged:

- the Web prototype is explicit, local-only by default, token-gated, and read-only;
- it has workspace rows, recent conversations, and opaque `cv_...` conversation detail handles;
- it must not be exposed by normal service startup, install flow, systemd, reverse proxy, tunnel, or
  public DNS until a later implementation gate passes;
- owner access is a preview/trial lane, not a support claim.

## Recommended First Protected Path

Recommended first owner-phone path: **VPN/private-network access using an owner-only
WireGuard/Tailscale-style network, plus the existing app-level auth/session gate**.

Why this is the safest first candidate:

- it avoids an unauthenticated public URL and keeps ingress limited to enrolled owner/controller
  devices before the Web app even sees a request;
- it is more suitable for phone validation than plain SSH local port forwarding, which is best for
  controller-only screenshots but awkward as the owner’s normal phone-browser path;
- it is easier to make owner-only than a reverse proxy or Cloudflare Tunnel, both of which can create
  a broadly reachable hostname if misconfigured;
- it supports a fast rollback by disabling the Web process and removing the private-network route or
  device access;
- it remains compatible with later HTTPS/session hardening without making public exposure the first
  milestone.

Pattern ranking for the first real protected URL:

| Candidate | First-use decision | Why |
|---|---|---|
| SSH local port forwarding | Use for controller-only smoke, screenshot, or emergency admin proof. | Narrowest exposure, but not the preferred owner phone UX unless the owner explicitly wants SSH from phone. |
| WireGuard/Tailscale/VPN-style private network | **Recommended first owner-phone path.** | Device-level private ingress plus app auth; no public hostname required. |
| Reverse proxy with HTTPS/auth | Later repeat-trial path after auth/session, logs, headers, and rollback are proven. | Stable, but public-facing mistakes have higher blast radius. |
| Cloudflare Tunnel/ngrok-style tunnel | Short one-off fallback only after auth and expiry controls are proven. | Convenient, but accidental public reachability and stale tunnel risk are higher. |
| Public DNS/HTTPS without private ingress | No for this phase. | Too easy to overclaim or expose state beyond the owner. |

## Explicit Non-Goals

This phase does not authorize or implement:

- unauthenticated public URL exposure;
- public Web support, mobile support, or service availability claims;
- raw terminal, shell prompt, app-server payloads, debug logs, stack traces, or raw command output;
- task submission, approval/question responses, interrupt, switch/resume controls, or other actions;
- multi-user, team, shared browser, or organization access;
- uploads, downloads, previews, file picker, paste-to-upload, or write-back flows;
- service auto-start, install-time exposure, systemd Web wiring, reverse proxy config, DNS, TLS, or
  tunnel scripts unless a later gate explicitly adds them;
- exposing raw platform IDs, chat IDs, user IDs, session IDs, callback payloads, local paths, config
  paths, artifact backing paths, env values, credentials, or tokens.

## Threat Model

| Threat | Risk | Required posture before exposure |
|---|---|---|
| Token leakage | Bearer token copied into screenshots, shell history, logs, browser storage, or referrers can open state. | Short-lived secret; never place token in URL; never print token; rotate after trial or suspected leak. |
| Browser history/referrer | URLs, paths, or query strings can persist or be sent to another origin. | No token or raw IDs in URL; same-origin links only; `Referrer-Policy: no-referrer`; no third-party assets. |
| Tunnel exposure | Tunnel or proxy may remain running or become reachable beyond the owner. | Explicit enable flag; owner-only ingress; expiry; shutdown proof; no default service exposure. |
| DNS/HTTPS mistakes | Public hostname, wrong certificate route, or cached DNS may outlive trial. | Prefer private network first; if public TLS is later used, require reversible DNS/proxy ownership and post-shutdown negative proof. |
| Origin/CSP gaps | Third-party scripts, mixed content, or permissive framing can leak state. | Strict CSP; no inline external dependencies unless reviewed; frame denied; no cross-origin reads. |
| Brute force | Exposed auth endpoint can be guessed or sprayed. | Rate limit/lockout or ingress allowlist; generic failures; audit denials. |
| Binding ambiguity | Browser could show the wrong platform/operator state when multiple bindings exist. | Require explicit platform binding filter and exactly one owner binding before state renders. |
| Stale session links | Old `cv_...` handles or browser tabs may keep opening state after a trial. | Server-side session expiry; handle invalidation on restart/token rotation; generic 404 for stale/unknown handles. |
| Local file/path leak | UI, errors, artifacts, or readiness may reveal home/temp/config paths. | Redacted labels and opaque handles only; generic errors; no raw artifact backing paths. |
| Operational rollback failure | Exposure cannot be stopped quickly during a leak or confusion. | Rollback drill must be known, tested, and recorded before any owner URL is shared. |

## Auth And Session Gate Requirements

Minimum gate before any owner-accessible URL:

1. **Localhost remains default.** External access requires an explicit flag/env and cannot happen through
   normal service startup.
2. **Short-lived secret.** Generate a trial-only secret, rotate after the trial, and never reuse the
   local smoke token for protected owner access.
3. **No token in URL.** Use a login/session exchange, Authorization header, or equivalent non-URL
   mechanism; do not use query strings, fragments, or path segments for secrets.
4. **Server-side or revocable session.** Phone access can expire or be revoked without code changes.
5. **Platform binding filter.** Require an explicit platform and exactly one resolved owner/operator
   binding before rendering state.
6. **Owner-only ingress.** Prefer private-network device membership; otherwise require an ingress
   allowlist in addition to app auth.
7. **Generic denial.** Unauthorized, stale, unbound, or invalid-handle requests return the same safe
   denial shape and reveal no project, path, platform, or binding details.
8. **Audit trail.** Record start/stop time, enabled exposure mode, successful auth, denied auth,
   binding selected, shutdown result, and token rotation event without logging secrets or raw IDs.
9. **Rate/lockout.** Add request rate limiting, auth lockout, or equivalent ingress throttling before
   any network-reachable auth endpoint.
10. **Headers/origin.** Keep no-store, nosniff, strict CSP, frame denial, and no-referrer behavior;
    avoid third-party scripts, fonts, or analytics.

## Rollback And Shutdown Drill

Before sharing any protected owner URL, the controller must know the exact stop path for the chosen
server and exposure mechanism. Use placeholders only in docs and logs; do not record real URLs or
secrets.

Required drill:

1. **Stop the Web server.** Terminate the explicitly started Web readonly process using the recorded
   process handle or supervisor stop command for the trial.
2. **Stop the exposure layer.** Disable the VPN share/route, remove the owner device from the trial
   policy, stop the SSH forward, stop the tunnel process, or disable the reverse-proxy route used for
   the trial.
3. **Rotate the trial secret.** Invalidate the short-lived secret or session store before restarting
   any Web process.
4. **Verify local port closed.** Confirm the selected local port is no longer listening on localhost or
   any non-loopback interface.
5. **Verify no process left.** Confirm no Web readonly, tunnel, proxy wrapper, or trial supervisor
   process remains from the exposure run.
6. **Verify endpoint denial.** From a non-authenticated client and, when applicable, from outside the
   private network, confirm the protected endpoint is unreachable or returns only the generic denial.
7. **Record proof.** Add a dated readiness/security note with exposure mode, start/stop result,
   token/session rotation result, port-closed proof, and public/private endpoint denial proof.

If any step fails, treat the trial as no-go until rollback is fixed and re-tested.

## Acceptance Checklist Before Any Real Protected URL

A protected owner URL is no-go until every item below has explicit evidence:

- local smoke: localhost-only run still passes unauthenticated generic denial and authenticated read-only
  `200` for Web Home and at least one `cv_...` conversation detail;
- sanitized screenshot: owner-reviewable screenshot or HTML proof shows useful workspace/conversation
  state and no token, raw ID, path, logs, terminal, or conversation-sensitive leak;
- unauthorized generic `404` or equivalent safe denial for `/`, conversation handles, stale handles,
  and unsafe route shapes;
- authenticated `200` only after the owner auth/session gate and owner binding filter pass;
- no token in URL, browser-visible path, rendered HTML, headers, screenshots, or logs;
- no raw session ID, chat/user/platform ID, callback payload, local path, config path, artifact backing
  path, env value, stack trace, terminal output, or app-server payload in default UI/error paths;
- owner-only ingress proof: private-network membership, allowlist, or equivalent proof exists before
  network exposure;
- brute-force control proof: rate/lockout or ingress throttle exists for auth attempts;
- shutdown proof: Web server stopped, exposure layer stopped, token/session rotated, local port closed,
  no leftover process, and protected endpoint unreachable or generically denied.

## Next Implementation Slices

This phase is docs-only. Later slices should remain narrow and independently reversible:

1. **Config seam.** Add typed config for protected access mode, token/session lifetime, binding filter,
   ingress mode label, and audit destination; default disabled.
2. **Explicit command flag.** Add a guarded command flag/env that must be present before non-local
   exposure is even attempted; localhost remains default.
3. **Auth/session hardening.** Replace or wrap the local bearer gate with a short-lived, non-URL,
   revocable browser session suitable for owner phone validation.
4. **Tunnel/private-network wrapper.** Add one wrapper for the approved first path only; do not add
   reverse proxy, public DNS, and tunnel variants in one slice.
5. **Health and shutdown check.** Provide a command or runbook that proves listener state, auth denial,
   binding status, process identity, and shutdown result without printing secrets.
6. **Smoke proof.** Capture sanitized proof for local authenticated/unauthenticated paths, owner-only
   ingress, stale handle denial, and shutdown.

Do not combine these slices with actions, uploads/downloads, raw logs/terminal, service auto-start, or
support-claim wording.
