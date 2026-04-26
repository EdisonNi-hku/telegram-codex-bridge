<!-- archived: moved from active plans after Phase 3 closeout; historical reconstruction only. Start new work from docs/roadmap/codex-console-continuation-brief.md. -->
# Web MVP Readiness Controller Triage

Status: controller-approved scope cut
Last updated: 2026-04-26

## Verdict

Accept the Codex high report with scope reduction.

Proceed with a **read-mostly Web MVP** as the first implementation target. The product shape is a
workspace/session/conversation Web app, not a generic management dashboard: start from workspaces,
inspect workspace conversations, and open conversation results. Do not implement App, public support
claims, raw terminal, multi-user collaboration, arbitrary project writes, uploads, or unauthenticated
public access in the first lane.

## Approved First Lane

| Area | Decision |
|---|---|
| Product direction | Web first, App later |
| Product claim | Prototype only; no current Web support claim |
| Deployment assumption | VPS Linux server |
| Owner validation | Screenshots/recordings first; later protected mobile-access URL |
| User model | Single high-trust operator |
| First implementation posture | Read-mostly |
| URL exposure | Only after login/access control exists |

## Approved MVP Pages

1. Web Home
   - workspace list and active workspace/session summary
   - recent conversations
   - compact runtime/readiness badges
   - degraded warnings

2. Workspace Sessions
   - active workspace/session
   - per-workspace conversation/session list
   - empty/error/unavailable states
   - read-only first

3. Conversation Detail / Results
   - conversation/session detail
   - final answer separated from progress
   - artifact descriptors and availability
   - preview/download only where safe and configured

4. Runtime
   - idle/queued/running/blocked/done/failed/degraded/unhealthy/recovered
   - compact and detailed status as contextual information
   - recent output summary, not raw terminal

5. Interactions
   - pending/resolved/expired/stale/duplicate/failed states
   - read-only first
   - response actions later behind explicit gate

6. Setup / Readiness
   - declared/configured/observed/UX-exposed matrix
   - auth/access status
   - capability gaps as a setup gate, not the main product experience

## Deferred Until Later

- App implementation.
- Public Web support claim.
- Multi-user/team collaboration.
- Raw terminal access.
- Arbitrary project writes/file editing.
- Full upload flow.
- Browser/mobile push notifications.
- Hosted/SaaS control plane.
- Repo/package/CLI/service/env-var renames.

## Action Gates

| Action | First lane decision | Gate before enabling |
|---|---|---|
| View Web Home/workspace sessions/conversation results/status | Approved after auth | Login/access control works |
| Switch/resume project/session | Deferred | owner approves action audit/recovery semantics |
| Submit text task | Deferred | CSRF/action protection, lifecycle visibility, failure visibility |
| Answer approval/question | Deferred | stale/duplicate/expiry handling visible |
| Interrupt | Deferred | action audit trail and recovery state visible |
| Upload files | Deferred | attachment validation/storage/retention plan |

## Readiness Model To Land Next

Each baseline capability must report four levels:

1. Declared — included in MVP target.
2. Configured — required config/process/storage/auth exists.
3. Observed — real run exercised the path.
4. UX-exposed — owner can use/inspect it in UI.

Baseline capabilities:

- login/access control
- operator binding
- workspace/session/conversation visibility
- runtime status visibility
- final answer visibility
- artifact/file visibility
- interaction visibility
- delivery/degraded outcome visibility
- mobile URL validation
- screenshot/recording evidence path

## VPS / Mobile Validation Rule

The project must validate in this order:

1. Local VPS run with screenshots/recordings.
2. Protected URL only after login/access control exists.
3. Owner phone validation of read-only flows.
4. Controlled actions only after security/readiness approval.

## Next Execution Package

Delegate Codex high to turn this triage into formal docs:

- Web MVP scope doc.
- Web readiness model doc or section.
- VPS/mobile validation and URL exposure gate.
- Router/catalog updates.

Controller must then verify:

- no Web support overclaim;
- App remains later but alive;
- first lane is Web-only/read-mostly;
- `git diff --check` and `npm run check` pass.
