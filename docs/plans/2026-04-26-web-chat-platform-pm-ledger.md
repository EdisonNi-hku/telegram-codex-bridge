# Web Chat Platform Landing PM Ledger

Status: active autonomous execution ledger  
Owner: Tuzi/Hermes as PM/controller; Codex runs implement/audit  
Started: 2026-04-26

## Owner mandate

The owner is asleep and explicitly delegated execution. Do not stop halfway waiting for routine decisions. Continue planning, delegating, reviewing, committing, pushing, restarting preview, and verifying until the Web becomes a usable chat platform.

## Product direction

Web is not primarily a dashboard. Web is a first-class chat surface for Codex Bridge, analogous to Feishu/Telegram:

- user opens browser;
- sees conversations;
- opens a conversation thread;
- types a message in a composer;
- Bridge receives the message and starts/continues work;
- replies/results/status appear in the Web thread;
- artifacts/results are accessible from the Web UI.

Dashboard/runtime/readiness pages are secondary utilities only.

## Execution rule

Tuzi should report only meaningful milestones, hard failures, verification failures, or owner decisions that truly cannot be made safely. Routine Codex launches and passing checks stay in this ledger.

## Current branch

- Repo/worktree: `/tmp/codex-console-phase2`
- Branch: `feat/codex-console-phase2`
- PR: #16 `Codex Console Web owner preview`
- Latest baseline commit before Web Chat pivot: `892e04a feat: add managed Web preview operations`
- Ubuntu checks green at baseline; Windows out of scope per owner.
- Managed preview currently running at `https://codex.guicheng.xyz`.

## Completed before pivot

- App-like owner preview shell, CSS, Home/result/workspace cards.
- Managed preview start/stop/status/smoke/rotate scripts.
- Tracked cookie proxy and runbook.

## New phase queue: Web Chat Platform

### Phase A — Web Chat contract and send-path audit

Goal: identify the smallest safe path for Web to act as a chat surface.

Deliverables:
- Durable doc/ledger update explaining Web Chat as first-class surface.
- Exact code hook for sending a browser message into Bridge/Core.
- Exact data model for conversation thread display.
- Implementation plan split into minimal slices.

### Phase B — Chat UI read surface

Goal: replace/augment dashboard with chat-first layout.

Deliverables:
- Home/chat route with conversation list + active thread + composer UI.
- Thread reads existing safe conversation/session data.
- Composer may be disabled only if send-path implementation is not yet landed, but copy must point to next slice.

### Phase C — Minimal Web message send

Goal: authenticated Web POST can submit a text message to Bridge for selected conversation/project/session.

Deliverables:
- Backend route/API for message submit.
- Safe CSRF/session/auth handling through existing owner proxy/bearer path.
- Starts or continues a bridge turn using existing service abstractions.
- Tests for success, denial, invalid input, no raw IDs/secrets.

### Phase D — Thread refresh/results

Goal: after sending, Web can observe updated thread/status/result.

Deliverables:
- Polling or refresh route; no WebSocket required initially.
- Owner sees queued/running/done/failed/waiting states and final result.

### Phase E — Live preview proof and PR closure

Goal: restart managed preview, smoke public URL, capture proof, update PR, mark ready/merge if acceptable.

## Active processes

- Phase B implementation: `proc_3a89c065bbf3` launched 2026-04-26 after Phase A contract commit `6cac234`.

## Next action

Monitor Phase B Codex high implementation run. On completion, review diff, run targeted tests plus `npm run check` and `git diff --check`, then commit/push if accepted and launch Phase C send-path tests/implementation.

## Phase A findings

Completed: 2026-04-26  
Mode: read-only source audit plus docs/status contract; no source code changed.

### 1. Existing inbound chat turn path

Current Telegram and Feishu ingress share the Telegram-shaped bridge path:

- Telegram polling reads updates and passes each update to the bridge service update handler.
- Feishu websocket events are translated by the Feishu compatibility poller into Telegram-shaped updates, including text messages, media descriptors, bot-menu events, and card callbacks; those translated updates enter the same bridge service update handler.
- The bridge service message handler authorizes the private sender, flushes runtime notices, handles pending rename/manual-path/interaction/rich-input states, resolves media, routes slash commands, and treats non-command text as normal work.
- Normal text uses the active bound session. If the active session is running and steer is available, it calls the app-server steer path to continue the active turn. If an interaction is pending or the session is busy, it blocks with the existing notices. If the session is idle, it starts a real text turn through the turn coordinator.
- The turn coordinator owns start-turn execution: capacity check, app-server availability, thread creation/reuse, startTurn request construction, session status updates, active-turn tracking, runtime-card reanchoring, and final-answer/runtime handoff.

Implication for Web: do not invent a second Codex start path. The Web send endpoint should adapt browser input into the same `chatId + SessionRow + text` semantics and call a small service-owned submit method that reuses the existing normal-text/turn coordinator behavior.

### 2. State/store/session APIs Web can use for read UI today

Existing read-safe inputs already support a useful conversation thread view:

- Operator binding: chat bindings can be listed and filtered by active platform, giving a single owner `chatId` for the Web view.
- Sessions/conversations: sessions can be listed by `chatId`, fetched by session id, listed with threads, and read as active session. Session rows include display name, project/workspace metadata, status, archived state, timestamps, thread id, and last turn status.
- Final answers: persisted final-answer/terminal-result views can be listed by `chatId` and filtered by session. They include answer id, session/thread/turn ids, delivery state, preview HTML/pages, and timestamps. The existing Web read model only renders bodies when a sanitized final-answer body provider supplies safe text.
- Pending interactions: pending interactions can be listed by chat, request, or turn and are already adapted into Web-safe pending cards.
- Runtime state: active turns are held by the running service; the current standalone read-only harness does not expose live active-turn data unless injected.
- Current Web read model: the Web readonly live provider scopes store reads to the single operator binding, hashes raw session/project ids into opaque workspace/conversation handles, lists workspace/conversation rows, and renders conversation detail from sessions, final answers, pending interactions, runtime, readiness, and artifact descriptors.

Gap: there is no persisted chronological user/assistant message table. Today Web can display a conversation/task thread as a session-centric detail page with final answers, pending cards, and runtime state, but not a full chat transcript of every user message unless a new neutral message/turn event projection is added later.

### 3. Smallest safe Web send endpoint design

Recommended first send contract:

- Route: `POST /conversations/:handle/messages`.
- Inputs: authenticated owner request, opaque `cv_...` conversation handle, plain text field `message`, optional idempotency nonce.
- Limits: text only, trimmed non-empty, explicit max byte/character limit, no attachments, no project/session creation, no raw ids in request or response.
- Binding/session resolution: resolve the single operator binding, map the opaque handle back to a session only inside the server, require the session to belong to the bound `chatId`, and reject archived/missing sessions generically.
- Execution: call a service-owned `submitWebTextMessage(conversationHandle, text, nonce)` or equivalent adapter that reuses the same normal-text semantics as platform messages: continue via steer when allowed, block on pending interaction/busy state, or start a turn through the turn coordinator when idle.
- Response: redirect back to `/conversations/:handle` for HTML form submissions, or return a tiny JSON outcome for fetch clients. The response should say accepted/blocked/invalid/unavailable in owner language, not expose thread id, turn id, app-server ids, chat ids, local paths, or stack traces.
- Auth/CSRF: keep the existing owner-only token/cookie proxy posture, but before enabling POST through the cookie proxy add same-origin CSRF protection. Practical first slice: hidden per-session CSRF token rendered into the composer, require it on POST, keep `SameSite=Lax`, reject unsafe origins, and continue generic denial for unauthorized requests.
- Endpoint placement: do not bolt this onto the standalone DB-only readonly harness as a fake write path. The endpoint must run in the live bridge process or receive a live bridge submit dependency, because only the running service has the app-server client, turn coordinator, active-turn map, runtime reanchoring, and pending-interaction state needed to behave like Telegram/Feishu.

### 4. Primary UI route

Use `/` as the primary chat home. The owner should land directly in a chat/work queue with conversation list, active conversation/result panel, and composer posture. Keep `/conversations/:handle` as the durable thread/detail route because it already uses opaque handles. Add `/chat` only as a convenience alias to `/`, not as the canonical product route. Runtime/readiness/settings remain secondary utility routes.

### 5. Exact files for Phase B and Phase C

Phase B — chat read UI, no writes:

1. `src/service/web-readonly-view-model.ts` — reshape the home/detail view model around chat-first sections and any disabled composer metadata; keep opaque handles and sanitized data boundaries.
2. `src/web/readonly-renderer.ts` — make `/` render as the chat home, add disabled composer/readiness copy, and keep utility cards secondary.
3. `src/web/readonly-http-server.ts` — optionally add `/chat` as an alias to `/`; keep `/conversations/:handle` as the thread route.
4. `src/service/web-readonly-view-model.test.ts` — lock chat-first home/detail view models, no raw ids/paths/tokens, and no action claim before Phase C.
5. `src/web/readonly-http-server.test.ts` — lock routing, no forms/actions before Phase C unless the composer is visibly disabled, security headers, and generic denial behavior.

Phase C — minimal message send:

1. `src/service.ts` — add a narrow Web submit method on the live bridge service that resolves the active store/session and delegates to existing normal-text/turn coordinator behavior; keep current Telegram/Feishu behavior unchanged.
2. `src/service/turn-coordinator.ts` only if a tiny reusable return/outcome is needed; otherwise do not touch it.
3. `src/web/readonly-http-server.ts` or a new small `src/web/chat-http-server.ts` — add `POST /conversations/:handle/messages` with injected `submitTextMessage` dependency. Prefer a new chat server/module if it avoids making the readonly harness pretend to own writes.
4. `src/web/readonly-renderer.ts` — enable the composer form only when the send capability is injected/ready; otherwise keep it disabled.
5. `src/web/readonly-access.ts` — extend access checks only if the POST path needs method-aware auth/CSRF helpers.
6. `scripts/web-owner-cookie-proxy.py` — allow authenticated POST forwarding to the upstream chat endpoint while keeping `/owner-login` special, limiting body size, forwarding content type safely, and preserving no-secret logging.
7. `src/cli.ts` and `scripts/web-preview-start.sh` only if the preview command must start the live chat-capable server differently from the readonly harness.
8. Tests beside each touched file: service submit tests, web HTTP POST contract tests, renderer composer tests, access/CSRF tests, and proxy self-test update if POST forwarding changes.

### 6. Tests to write first

Phase B tests first:

1. View-model test: home returns chat-first data (`recentConversations`, pending attention, runtime) with opaque conversation handles and no raw session/chat/thread ids.
2. HTTP/render test: `GET /` is the chat home and contains conversation links plus disabled composer copy when send is unavailable.
3. HTTP/render test: `GET /chat` aliases to the same chat home if the alias is added.
4. Detail test: `GET /conversations/cv_...` renders final answer, pending state, runtime state, and disabled composer posture without raw internals.
5. Regression test: no form POST/action controls exist until send capability is explicitly enabled.

Phase C tests first:

1. Unauthorized POST and wrong-token POST return generic denial and do not invoke submit dependencies.
2. Invalid handle, missing/blank/oversize message, archived/mismatched session, and missing CSRF all reject without invoking turn start/steer.
3. Successful idle-session POST resolves the opaque handle to the bound session and calls the live submit adapter exactly once with `chatId`, session, text, and nonce.
4. Running-session cases preserve current semantics: steer when available, block when interaction-pending or busy, and do not start a parallel turn incorrectly.
5. Response safety: accepted/blocked/invalid responses and redirects do not include raw ids, local paths, tokens, stack traces, or app-server payloads.
6. Proxy self-test: authenticated owner cookie can forward POST to the upstream endpoint with Authorization injected; unauthenticated POST remains denied except `/owner-login`.

### 7. Risks and blockers

- Current Web preview is a standalone DB reader. It can render read state, but it cannot safely start/continue turns by itself because it lacks the live app-server client and turn coordinator.
- Existing persisted data is session/final-answer oriented, not full chronological chat transcript. A real chat timeline may need a neutral persisted turn/message projection after the minimal send path lands.
- Opaque conversation handles are currently hash-derived one-way handles. Send needs a server-side reverse lookup through scoped sessions, not client-supplied raw session ids.
- Active runtime state is in memory in the live bridge service; the standalone preview only sees what is persisted/injected. Live Web Chat should run against the live service boundary for accurate running/blocked behavior.
- Cookie proxy currently forwards only GET/HEAD to the upstream and treats non-login POST as not found. Phase C must update it before browser form POST works through the owner preview URL.
- CSRF is not needed for the current bearer-only readonly upstream, but becomes relevant once cookie-authenticated browser POST is allowed.
- Keep the first action lane text-only. Attachments, approvals, interrupts, project/session writes, downloads, and multi-user auth should remain out of the first send slice.

## Ordered Phase B/C implementation plan

### Phase B — Chat read UI, still no writes

1. Make `/` visibly chat-first: conversation/work queue first, active/attention/result sections next, utilities secondary.
2. Keep `/conversations/:handle` as the thread/detail page and add a disabled composer panel that clearly says sending is the next slice.
3. Optionally add `/chat` as an alias to `/`; do not make runtime/readiness the landing flow.
4. Preserve all current safety properties: opaque handles, sanitized labels/body sources, no raw ids/paths/tokens, no enabled forms/buttons/actions.
5. Run targeted Web view-model and HTTP renderer tests, then `npm run check`.

### Phase C — Minimal Web message send

1. Write failing tests for the POST contract, auth/CSRF rejection, invalid input, generic errors, and successful dependency invocation.
2. Add an injected Web submit contract that resolves `cv_...` to the bound session and calls a live service submit method; avoid direct app-server calls from Web HTTP code.
3. Add `POST /conversations/:handle/messages` with strict text-only parsing, body limits, idempotency/nonce field, generic denial, and safe redirect/JSON outcomes.
4. Enable the composer only when the send dependency and CSRF token provider are present; otherwise keep Phase B disabled copy.
5. Update the owner cookie proxy to forward authenticated POSTs to the upstream endpoint with small body limits and no request logging.
6. Verify with unit tests, proxy self-test, `npm run check`, and a local Ubuntu smoke through the managed preview chain before any PR-ready claim.
