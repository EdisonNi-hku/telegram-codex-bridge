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
  - docs/plans/2026-04-26-product-web-console-mvp.md
  - docs/plans/2026-04-26-web-gated-actions-design.md
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

Latest committed Phase 1 Web-first checkpoints:

- `61d2f10 feat: add Web-first read-only view-model seam`
- `0a590f6 feat: add Web artifact descriptor view models`
- `93fa360 feat: add Web read-only live provider seam`
- `eee1273 feat: add local read-only Web shell module`
- `bceff02 feat: add local Web readonly harness`
- `6a77f8d feat: populate Web rows from scoped sessions`
- `39f31cb feat: add Web readonly platform binding filter`

These commits include:

- Web/App pre-implementation contract and MVP/readiness docs.
- VPS/mobile access/security plan.
- Web read-only prototype implementation plan and view-model inventory.
- Read-only Web ViewModel/provider seams with redaction, final-answer metadata, pending interactions, artifacts, runtime, and readiness surfaces.
- Dependency-free local-only HTTP shell, explicit token-gated CLI harness, scoped session-backed rows, and platform-only binding filter.

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

## Phase 2 Web Console MVP Todo

Controller direction: move from local read-only substrate to an owner-visible Web Console MVP while preserving denied-by-default, read-only-first guardrails.

Active todo list:

1. PR #16 review/merge path: keep the Draft PR tracked, keep Ubuntu-pass/Windows-baseline context documented, and do not let existing Windows baseline failures block Web-specific progress unless a new Web regression appears.
2. Owner-visible proof artifact: run the local token-gated Web prototype with `--platform feishu`, capture a safe screenshot/recording or HTML proof that can be reviewed without exposing token, raw IDs, local paths, terminal logs, or platform internals.
3. More useful read-only dashboard: add safe conversation detail, sanitized final-answer body where a safe source exists, runtime/readiness panels, and pending-interaction read-only visibility.
4. Protected owner access plan: completed as a docs-only design gate; use the protected owner access plan before any owner phone/browser URL exposure. No public/mobile exposure is implemented.
5. Gated actions design: completed as a docs-only gate; use the gated-actions design before any Web submit, approval-answer, or interrupt implementation. Do not implement actions in the read-only MVP lane.

Phase 2B investigation completed:

- Process: `proc_a1293acfebc9` exited 0.
- Monitor: `f9c6382df17c` paused.
- Prompt: `/tmp/codex-web-dashboard-data-investigation.md`
- Report: `/tmp/codex-web-dashboard-data-investigation-report.md`
- Accepted controller direction: implement a safe conversation detail slice with Web-only opaque `cv_...` handles and same-origin links; keep final-answer body unavailable unless supplied through the existing sanitizer seam; keep runtime degraded in the local harness unless a live runtime reader is injected; no public exposure or actions.

Phase 2B implementation completed and controller-verified:

- Process: `proc_3ff3c8824320` exited 0.
- Monitor: `e7de34953605` paused.
- Status: `.hermes/web-conversation-detail-status.md`
- Result: Web rows now expose `cv_...` opaque conversation handles; local HTTP shell supports token-gated `GET /conversations/:handle`; renderer links use only same-origin opaque handles; raw `/sessions/:id` routes are not linked and unsafe route parts return generic 404.
- Controller verification passed:
  - `node --import tsx --test src/service/web-readonly-view-model.test.ts src/service/web-readonly-live-provider.test.ts src/web/readonly-http-server.test.ts src/web/readonly-cli.test.ts` passed with 38 tests.
  - `npm run check` passed.
  - `git diff --check` passed.
- Controller smoke proof on current local state passed with command shape `CTB_WEB_READONLY_TOKEN=*** node --import tsx src/cli.ts web readonly --platform feishu --port 45681`: authenticated home returned 200 with `cv_...` conversation links, no `/sessions/` links, no token leak; authenticated first `/conversations/:handle` returned 200, no `/sessions/` links and no token leak; smoke server was killed and token file removed.

Current first execution item: owner-visible proof artifact, because it most directly validates the user's original goal: a Web end that can access Bridge/Codex state in a browser.

Owner-visible proof artifact completed by controller:

- Started local prototype with command shape `CTB_WEB_READONLY_TOKEN=*** node --import tsx src/cli.ts web readonly --platform feishu --port 45680`.
- Authenticated `/` returned 200 and contained `Codex Console Web prototype` with operator binding available, readiness ready, workspace rows, and recent conversation rows.
- Raw proof HTML was sanitized for owner review: workspace labels and conversation text were redacted.
- Sanitized artifacts:
  - `/tmp/ctb-web-proof-safe.html`
  - `/tmp/codex-console-web-proof-safe.png`
- Vision verification confirmed the sanitized screenshot shows title/workspace/recent-conversation tables and does not show bearer token, raw paths, raw IDs, or conversation text.
- The local server was killed after proof and the temporary token file was removed.

Protected owner access design completed as a docs-only gate:

- Status artifact: `.hermes/protected-owner-access-status.md`
- Durable artifact: `docs/plans/2026-04-26-web-protected-owner-access-plan.md`
- Result: owner-only protected access is specified as a future preview path, not shipped support. The recommended first path is a WireGuard/Tailscale/VPN-style private network plus app-level auth/session gates, with SSH forwarding kept for controller-only proof and public reverse proxy/tunnel paths deferred or fallback-only.
- Required gates now include short-lived non-URL secrets, localhost default, explicit enable flag/env, platform binding filter, audit trail, rate/lockout or ingress allowlist, rollback/shutdown drill, and acceptance proof before any real protected URL.
- Still not implemented: public URL, owner/mobile URL, reverse proxy, tunnel, VPN wrapper, HTTPS/DNS, service auto-start, browser session login, actions, uploads/downloads, raw terminal/logs, or support claim.

Gated Web actions design completed as a docs-only gate:

- Status artifact: `.hermes/gated-actions-design-status.md`
- Durable artifact: `docs/plans/2026-04-26-web-gated-actions-design.md`
- Result: future Web actions are explicitly sequenced as action 0 no-op/readiness capability display, action 1 allowlisted approval/question answer, action 2 confirmed interrupt/stop, and action 3 submit-new-task only after workspace/binding/session semantics and audit are proven.
- Required gates now include protected owner access passed first, explicit owner auth/session, single resolved binding/platform, CSRF or equivalent replay protection, action audit log, idempotency/action nonce, confirmation for destructive or interruptive actions, rollback path, opaque server-scoped handles, generic stale/duplicate denial, and kill-switch verification.
- Still not implemented: no-op action capability display, approval-answer, interrupt, task submit, uploads/downloads, artifact download, raw terminal, arbitrary command execution, public/mobile URL exposure, multi-user semantics, or Web support claim.

## Handoff Checkpoint: Product Web Console MVP

Owner correction: the current Portal is not a user-facing Web product; it is only an owner-visible read-only debug/admin preview. This correction is accepted as the next-phase framing.

Current temporary owner preview is live at `https://codex.guicheng.xyz` through Cloudflare Tunnel, form-login cookie proxy, and local Web readonly origin. It is not a supported/public service. Secrets live under `/tmp/ctb-web-access/` and must not be copied into docs or chat summaries.

Handoff note written to `/tmp/codex-console-handoff-2026-04-26.md`.

Next phase should be Phase 3 Product Web Console MVP:

1. Define real product IA and core flows: home, conversations/tasks, detail, pending, settings.
2. Replace table-like debug views with a readable mobile-friendly Console shell.
3. Add safe final-answer body rendering from a Web-neutral source.
4. Add useful live state: running turn, pending question/approval, readiness/runtime in user language.
5. Only after read UX works, add the first gated action lane with auth/session, CSRF/replay protection, audit, idempotency, kill-switch, and rollback.
6. Convert temporary preview into managed owner preview service.

## Guardrails

Do not claim Web is shipped, supported, public, or product-complete. Current browser access is a temporary owner preview only.

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

## Phase 3 Current State: Product Web Console MVP

Phase 3 has landed the first product-shaped read-only Web Console MVP slices on PR #16 through `d66ff3d`.

Durable MVP spec:

- `docs/plans/2026-04-26-product-web-console-mvp.md`

Current accepted scope:

- Web-first, App-later.
- Current browser preview remains an owner-visible temporary read-only debug/admin preview, not a user-facing Web product.
- First lane remains single-operator, owner/private, denied-by-default, and read-mostly.
- Phase 3 product direction is a real Web Console information architecture: Home, Workspaces/Projects, Conversations/Tasks, Conversation/Task Detail, Pending/Approvals, and Runtime/Readiness/Settings.
- The MVP must make conversation/task status and final results readable from phone/desktop without raw IDs, paths, tokens, platform internals, Telegram-shaped copy, or table-only debug pages.
- Final-answer body rendering may use only sanitized Web-neutral sources. If none exists, the UI must show an explicit unavailable/degraded state and must not scrape Telegram/Feishu/debug HTML.
- Action controls remain deferred. The later action lane must be separately gated, with approval/question answer or submit draft chosen explicitly after the read UX is useful.

Next implementation slices, in order:

1. Build the first real Console shell and readable conversation/task detail UI using existing safe read-only data; this is the immediate next code slice and should not drift back into substrate-only work.
2. Refine final-answer body rendering from sanitized Web-neutral sources, with explicit unavailable/degraded copy when absent.
3. Add conversation/task list grouping and user-language states for running, blocked, pending question, pending approval, done, failed, degraded, and unavailable.
4. Add a Pending/Approvals read-only page or section, with no active action controls.
5. Add Runtime/Readiness/Settings read page in safe owner language.
6. Produce owner-reviewable screenshot/HTML proof after readable UI lands.
7. Decide the first gated action lane only after the read UX and proof pass.

## Phase 3 Console Shell Code Slice 1

Completed on 2026-04-26 as the first Product Web Console MVP implementation slice after `f2f6050`.

Result:

- Replaced the read-only renderer's table-first debug feel with a shared `Codex Console` owner-preview/read-only shell.
- Home now uses orientation cards plus workspace, recent conversation/task, and active-turn card lists.
- Conversation/task detail now separates status, final answer/result, pending interactions, runtime, readiness, and warnings.
- Missing Web-safe final-answer bodies now render explicit unavailable copy instead of an empty table.
- Existing token-gated HTTP routes, opaque `wk_...` / `cv_...` links, escaping/scrubbing, generic unauthenticated 404 denial, and security headers were preserved.

TDD/verification evidence is recorded in `.hermes/phase3-console-shell-status.md`.

Verification passed:

- `node --import tsx --test src/web/readonly-http-server.test.ts src/web/readonly-cli.test.ts src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts`
- `npm run check`
- `git diff --check`

Controller smoke proof after the code slice:

- Started local harness with command shape `CTB_WEB_READONLY_TOKEN=*** node --import tsx src/cli.ts web readonly --platform feishu --port 45684`.
- Unauthenticated `/` returned 404.
- Authenticated `/` returned 200, included the shared Console shell/nav, and did not contain the temporary bearer token, raw `/sessions/` links, local absolute paths, callback payload labels, or message-id labels.
- Authenticated first `/conversations/:handle` returned 200, included the result panel, and passed the same leak checks.
- Smoke HTML files were deleted and the local harness process was killed after proof.

## Phase 3 Final Answer Body Source Refinement

Completed on 2026-04-26 as Product Web Console MVP code slice 2.

Result:

- Conversation/task detail continues to render only existing sanitized Web-neutral final-answer body data from the optional sanitizer seam.
- Available final-answer text is rendered as escaped readable result body content.
- Missing body sources keep explicit unavailable copy; rejected bodies now show explicit Web safety-filter unavailable copy.
- Injected bodies containing local paths or tokenized URLs are rejected instead of being redacted into visible body text.
- `previewHtml` and `pages` remain forbidden as body sources; no platform preview/page scraping, routes, actions, downloads, uploads, raw terminal/protocol output, or auth/service wiring were added.

TDD/verification evidence is recorded in `.hermes/phase3-final-answer-body-status.md`.

Verification passed:

- `node --import tsx --test src/service/web-readonly-view-model.test.ts src/web/readonly-http-server.test.ts`
- `node --import tsx --test src/web/readonly-http-server.test.ts src/web/readonly-cli.test.ts src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts`
- `npm run check`
- `git diff --check`

## Phase 3 Conversation/Task State Grouping

Completed on 2026-04-26 as Product Web Console MVP code slice 3.

Result:

- Home recent conversations and workspace conversation/task lists now group rows into owner-visible buckets: Needs attention, Running now, Recently completed, and Other/Older when row state supports it.
- Conversation/task cards render user-language state labels and short copy for running, pending question, pending approval, blocked, done/completed, failed, degraded, and unavailable/unknown states.
- Conversation/task detail status now uses the same user-language label/copy rather than raw row status text.
- Opaque links, escaping/scrubbing, read-only posture, and forbidden action/control constraints were preserved; no routes, auth, proxy, service wiring, schema, stores, or action endpoints were changed.

TDD/verification evidence is recorded in `.hermes/phase3-conversation-state-status.md`.

Verification passed:

- `node --import tsx --test src/web/readonly-http-server.test.ts src/service/web-readonly-view-model.test.ts`
- `node --import tsx --test src/web/readonly-http-server.test.ts src/web/readonly-cli.test.ts src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts`
- `npm run check`
- `git diff --check`

## Phase 3 Pending/Approvals Read-only Slice

Completed on 2026-04-26 as Product Web Console MVP code slice 4.

Result:

- Pending/Approvals now renders owner-readable read-only cards grouped by attention, resolved/duplicate, stale/expired, and unavailable/failed states.
- Pending cards use user-language labels/copy for question, approval, resolved, expired, stale, duplicate, failed, and unavailable-like states, with explicit response-disabled posture.
- Conversation/task detail reuses the same pending card rendering for its pending panel.
- No action controls, forms, POST method hints, submit/approval/question/interrupt URLs, callback payloads, raw pending IDs, platform message IDs, tokens, or local paths were added.

TDD/verification evidence is recorded in `.hermes/phase3-pending-approvals-status.md`.

Verification passed:

- `node --import tsx --test src/web/readonly-http-server.test.ts src/service/web-readonly-view-model.test.ts`
- `node --import tsx --test src/web/readonly-http-server.test.ts src/web/readonly-cli.test.ts src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts`
- `npm run check`
- `git diff --check`

## Session Closeout: Phase 3 Read-only MVP Slices

Closeout state on 2026-04-26:

- Latest pushed PR #16 commit: `d66ff3d feat: add Web pending approvals read view`.
- Hermes cron monitors for this workstream: none enabled after closeout checks.
- GitHub checks at closeout: latest Ubuntu jobs were running/passing in the expected pattern; Windows jobs remain the documented baseline risk unless a new Web-specific failure appears.
- Temporary owner preview was restarted on the latest branch and verified through `https://codex.guicheng.xyz/owner-login` with cookie proxy and localhost Web origin.
- Public owner preview verification passed: login page 200, authenticated Home 200, authenticated conversation detail 200, shared Console shell/nav present, result panel present, and no bearer token, `/sessions/`, local path, callback payload label, or message-id label in captured HTML.
- Scratch `.hermes/` status artifacts remain uncommitted intentionally.

Archived/demoted during closeout:

- Phase 2 plan and release note.
- Web-first project command board.
- Web MVP controller triage.
- Web view-model inventory.
- Web read-only prototype implementation plan.
- Web-first Phase 1 closeout.

Next recommended queue:

1. Finish PR #16 checks/merge path, treating Windows failures as baseline only if they match prior non-Web failures.
2. Implement Runtime/Readiness/Settings read-only page in safe owner language.
3. Produce owner-reviewable screenshot/HTML proof from the protected preview.
4. Harden managed owner preview start/stop/rotate workflow; do not make Web default service startup.
5. Run independent overclaim/security review before any MVP-support wording.
6. Decide first gated action lane only after read UX + protected access gates pass.

## Phase 3 Runtime / Readiness / Settings Read-only Slice

Completed on 2026-04-26 as Product Web Console MVP code slice 5 after the Product Web Console phase closeout baseline.

Result:

- Runtime now presents owner-language product panels for current operating state, active conversation/task turns, degraded/unavailable guidance, and Settings / access posture.
- Readiness now presents a baseline capability/readiness matrix with owner-language observed-state labels, setup/access posture, setup-needed gaps, and explicit support-claim guardrail copy.
- The slice stayed read-only: no forms, POST routes, submit/approval/question/answer/interrupt controls, uploads/downloads, raw terminal/log views, route changes, auth/proxy/service startup changes, or action affordances were added.
- Renderer scrubbing now also hides `/sessions/...` fragments and session-like labels in rendered text/warnings.

TDD/verification evidence is recorded in `.hermes/phase3-runtime-readiness-settings-status.md`.

Verification passed:

- `node --import tsx --test src/web/readonly-http-server.test.ts src/service/web-readonly-view-model.test.ts`
- `node --import tsx --test src/web/readonly-http-server.test.ts src/web/readonly-cli.test.ts src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts`
- `npm run check`
- `git diff --check`
