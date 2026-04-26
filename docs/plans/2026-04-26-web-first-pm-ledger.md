<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: PM-owned live ledger for Codex Console Web-first execution state, corrections, and next gates
read_when:
  - resuming Codex Console Web-first execution
  - checking current PM/controller state after delegated Codex work
  - deciding whether to report to the owner or continue silently
skip_when:
  - the task is only about shipped Telegram or Feishu behavior
  - the task needs historical reconstruction older than this Web-first lane
source_of_truth:
  - docs/plans/2026-04-26-web-first-pm-ledger.md
  - docs/roadmap/codex-console-continuation-brief.md
  - docs/plans/2026-04-26-web-viewmodel-inventory.md
-->

# Codex Console Web-First PM Ledger

Status: active PM/controller ledger  
Owner: Hermes/Tuzi as project PM; Codex runs are implementation/review subagents  
Last updated: 2026-04-26

## Mission

Push Codex Console toward a real Web-first control surface without drifting into fake support claims.

Web-first means:

- Web before native App.
- First lane is single-operator, non-public, read-mostly/prototype-only.
- Web should be workspace/session/conversation/result centered, not a fake Telegram/Feishu chat shell.
- Shared Codex Bridge Core semantics must remain the source of product meaning.

## Owner Reporting Rule

Do not interrupt the owner with every sub-step.

Report only when one of these happens:

1. Web actually lands as a usable milestone, such as a real protected page/shell or owner-reviewable screenshot/URL gate.
2. A clear crash/blocker happens, such as failing verification, broken build, lost worktree, or Codex/provider failure that changes the plan.
3. Direction/scope mismatch appears, such as Web support overclaim, action controls entering too early, auth/security disagreement, or need for owner decision.

Routine Codex launches, audits, doc cleanup, and passing intermediate tests should stay in this ledger and controller notes, not chat spam.

## Current Checkpoint

Committed checkpoint:

- `61d2f10 feat: add Web-first read-only view-model seam`

That commit includes:

- Web/App pre-implementation contract.
- Web MVP scope/readiness docs.
- VPS/mobile access/security plan.
- Web read-only prototype implementation plan.
- Web view-model inventory.
- Initial read-only Web view-model adapter and tests.
- Closeout wording updates after Gap2.

Scratch/status artifacts under `.hermes/` are not product artifacts and should stay out of product commits unless intentionally promoted.

## Implemented Surface So Far

Implemented code is limited to:

- `src/service/web-readonly-view-model.ts`
- `src/service/web-readonly-view-model.test.ts`

Current read-only adapter capabilities:

- Web home summary.
- Workspace list.
- Workspace conversation list.
- Conversation result / final-answer availability.
- Runtime context.
- Pending interactions read model.
- Readiness guardrails.

Completed gaps:

- Gap1: safe injected final-answer body exposure and workspace opaque labels/path redaction.
- Gap2: pending-interactions read model with unavailable/degraded handling and redaction.

Current verified baseline before Gap3:

- `git diff --check` passed.
- `npm run check` passed.
- `node --import tsx --test src/service/web-readonly-view-model.test.ts` passed with 9 tests.

## Active Work

Gap3 completed cleanly and was controller-verified:

- Process: `proc_1bae009f0f5a`
- Status artifact: `.hermes/web-viewmodel-gap3-status.md`
- Result: neutral read-only artifact catalog/descriptors added to the Web view-model seam.

Gap3 kept descriptor-only scope:

- no downloads, previews, file reads, routes, UI, auth, server, actions, uploads, raw paths, URLs, platform IDs, raw terminal, or raw protocol payloads.

Controller verification after Gap3:

- `git diff --check` passed.
- `npm run check` passed.
- `node --import tsx --test src/service/web-readonly-view-model.test.ts` passed with 11 tests.

## Live Provider Seam

A follow-up live provider composition seam completed cleanly and was controller-verified:

- Process: `proc_2c4cb3d1ca51`
- Status artifact: `.hermes/web-live-provider-status.md`
- Result: `createWebReadonlyLiveProvider(deps)` resolves one operator binding internally and feeds safe scoped readers into the pure Web view-model provider.

The seam keeps chat IDs/platform details inside the adapter boundary and does not add routes, UI, server, auth middleware, URLs, screenshots, action controls, writes, downloads, uploads, or runtime service wiring.

Controller verification after the live provider seam:

- `node --import tsx --test src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts` passed with 16 tests.
- `npm run check` passed.
- `git diff --check` passed.


## Local Read-only HTTP Shell

A first minimal local-only Web shell module completed cleanly:

- Status artifact: `.hermes/web-readonly-shell-status.md`
- Result: dependency-free Node HTTP server factory with injected Web read-only provider, denied-by-default bearer access gate, escaped read-only HTML renderer, and generic denied/error responses.

The shell remains module-only and unintegrated from CLI/service startup. It does not add public URLs, owner/mobile URL exposure, reverse proxy, HTTPS/DNS/tunnel setup, cookies/session login, actions, writes, uploads/downloads, previews, logs, raw terminal, or app-server protocol payload rendering.

Verification after the local shell:

- `node --import tsx --test src/web/readonly-http-server.test.ts src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts` passed with 22 tests.
- `npm run check` passed.
- `git diff --check` passed.

## Local Harness Smoke Proof

The explicit local harness was smoke-tested by the controller:

- Command shape: `CTB_WEB_READONLY_TOKEN=<token> node --import tsx src/cli.ts web readonly --port 0`
- Listener observed on `127.0.0.1:<ephemeral-port>`.
- Unauthenticated `/` returned generic 404 with no state data.
- Authenticated `/` returned escaped read-only HTML for `Codex Console Web prototype` with no-store/CSP/nosniff headers.
- The smoke instance was killed after proof.

This is an owner-visible local proof path, but still not public, not mobile-exposed, not installed into service startup, and not a Web support claim.

## Next Gates

1. Checkpoint the explicit local harness plus this PM ledger. Completed in `bceff02 feat: add local Web readonly harness`.
2. Read-only data-population investigation completed: `proc_6e331d9a80a3`, monitor `78fe54afe14e` paused, report `/tmp/codex-web-data-population-investigation.md`. Decision: next safest slice is scoped session-backed workspace/home rows, not final-answer bodies or public exposure.
3. Scoped session-backed rows implementation completed: `proc_ae673303a7c8`, monitor `a3767f8b9cf0` paused, status `.hermes/web-scoped-session-rows-status.md`. Controller verification passed with 29 Web tests, `npm run check`, and `git diff --check`.
4. Prepare a controller-owned screenshot/proof artifact from the local harness when needed.
5. Platform binding filter implementation completed: `proc_652eabc7a7ee`, monitor `cfb49e7e5205` paused, status `.hermes/web-platform-binding-filter-status.md`. Controller verification passed with 35 Web tests, `npm run check`, and `git diff --check`.
6. Controller smoke proof: `CTB_WEB_READONLY_TOKEN=*** node --import tsx src/cli.ts web readonly --platform feishu --port 45679` listened on `127.0.0.1`, authenticated `/` returned 200 with operator binding available and no `workspace_data_unavailable`; smoke instance was killed.
7. Later lanes may include persisted neutral final-answer bodies, readiness model refinement, screenshot/proof artifacts, or protected owner-review exposure planning; do not add publicly reachable routes, owner/mobile URL exposure, action controls, uploads/downloads, or support claims without an explicit controller gate.

## Guardrails

Do not claim Web is shipped, supported, enabled, public, or browser-usable yet.

Still not implemented for the Web prototype:

- Normal service startup/systemd wiring for Web.
- Public or owner/mobile URL exposure.
- Browser support claim.
- Cookie/session login flow.
- Auth/session binding beyond the injected bearer gate.
- Screenshot harness/mobile evidence.
- Task submission.
- Approval/question answering.
- Interrupt.
- Uploads/downloads.
- Switch/resume controls.
- Multi-user/team features.
- Native App.


## Explicit Local Read-only Harness

A first explicitly invoked local-only CLI harness completed cleanly:

- Status artifact: `.hermes/web-local-harness-status.md`
- Result: `ctb web readonly` starts the existing dependency-free read-only shell with the live provider seam only when an explicit bearer token is supplied by `CTB_WEB_READONLY_TOKEN` or `--token`.

The harness remains disabled by default and is not integrated into normal service startup/install/systemd. It binds to `127.0.0.1` by default, rejects CLI host binding, prints only the localhost URL plus prototype/token warning, and never prints the token.

Verification after the local harness:

- `node --import tsx --test src/web/readonly-cli.test.ts src/cli.test.ts src/web/readonly-http-server.test.ts src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts` passed with 29 tests.
- `npm run check` passed.
- `git diff --check` passed.

Still not implemented: public/mobile URL exposure, reverse proxy/tunnel/HTTPS/DNS, service autostart, browser support claim, action controls, writes, uploads/downloads, previews, raw logs/terminal/protocol rendering, or Web support status.

## Scoped Session-backed Rows Checkpoint

The local read-only Web harness now has a narrower safe data-population path: when exactly one operator binding resolves, workspace/home rows can be derived from that binding's scoped, non-archived sessions. The live Web provider no longer forwards global recent-project or project-stat readers into the Web view-model path, so unscoped project fixtures cannot populate Web workspace rows.

This remains local read-only prototype plumbing only. It does not add final-answer body rendering, public/mobile exposure, auth redesign, operator selection, screenshot flow, or action controls.

## Platform Binding Filter Checkpoint

The explicit local read-only Web harness now accepts a narrow operator binding filter by platform only: `CTB_WEB_READONLY_PLATFORM=telegram|feishu` or local `--platform telegram|feishu`. Invalid platform values fail before the server starts. With no platform filter, the previous safe default remains: all bindings are considered and the live provider only scopes data when exactly one binding resolves.

This does not expose raw chat/user/message IDs, does not auto-select across platforms, and does not add an operator selector UI, public/mobile exposure, service startup wiring, actions, uploads/downloads, logs/terminal/protocol rendering, or final-answer body rendering.

Controller smoke proof showed `--platform feishu` can make the local authenticated page data-bearing on the current local state without exposing raw IDs: operator binding became available, `workspace_data_unavailable` disappeared, and the instance was shut down after proof.
