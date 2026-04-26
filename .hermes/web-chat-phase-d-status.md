# Web Chat Phase D Status

## Completed YES/NO
YES

## Actual scope
- Wired the Web Chat HTTP surface into the live `BridgeService` process via `createWebChatHttpServer(...)` and `startWebChatHttpServer(...)`.
- Added environment-gated live startup with `CTB_WEB_LIVE_ENABLED` / `CTB_WEB_CHAT_ENABLED`, local-only host validation, token requirement, and deterministic CSRF token derivation when no explicit token is supplied.
- Built the live readonly provider from the running service store/runtime so conversation detail can include current active-turn status plus persisted results and pending interactions.
- Added safe thread refresh affordance and send-status flash copy after POST redirects, without exposing raw chat/session/thread/turn ids, local paths, tokens, stack traces, or app-server payloads.
- Kept disabled/read-only copy for the standalone harness while changing send-enabled Web Chat pages to describe the thread as live/continuable rather than view-only.
- Updated the managed preview start script to support `CTB_WEB_PREVIEW_MODE=live`, reusing an already-listening live bridge Web Chat upstream instead of starting the DB-only readonly harness.

## Files changed
- `src/service.ts`
- `src/service-web-submit.test.ts`
- `src/web/readonly-http-server.ts`
- `src/web/readonly-http-server.test.ts`
- `src/web/readonly-renderer.ts`
- `scripts/web-preview-start.sh`
- `docs/plans/2026-04-26-web-chat-platform-pm-ledger.md`
- `.hermes/web-chat-phase-d-status.md`

## Tests run
- `npx tsx --test src/web/readonly-http-server.test.ts src/service-web-submit.test.ts`
- `npm run check`
- `python3 scripts/web-owner-cookie-proxy.py --self-test`
- `bash -n scripts/web-preview-start.sh`
- `git diff --check`

## Live-service usability
Live-service wiring is now implemented. When the managed bridge service is started with `CTB_WEB_LIVE_ENABLED=1`, a local owner-authenticated Web Chat upstream exposes the chat-first UI with an enabled composer and delegates browser text messages to the same service submit seam used by existing bridge turn semantics.

## Risks / notes
- The live Web Chat upstream is intentionally local-only and should stay behind the owner cookie proxy/public tunnel.
- Managed preview live mode requires the live bridge service to be running with matching token/port environment; the preview script fails closed if the live upstream is absent.
- The first refresh model is still HTTP refresh/poll-by-reload, not WebSocket streaming.
- Thread display remains session/result/runtime oriented until a chronological message projection lands.

## Next Phase E plan
1. Configure/start the managed bridge service with live Web Chat enabled.
2. Restart managed preview in live mode and smoke login, home, conversation detail, composer presence, safe POST behavior, and public URL.
3. Verify public pages/responses do not leak raw ids, local paths, tokens, passwords, or stack traces.
4. Update the PR body with live preview URL, tests, and Windows out-of-scope note when requested.
