<!-- archived: moved from active plans after Phase 3 closeout; historical reconstruction only. Start new work from docs/roadmap/codex-console-continuation-brief.md. -->
<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: phase-1 closeout for the Codex Console Web-first local read-only prototype, including commits, verification, and next-stage task board
read_when:
  - resuming Codex Console Web-first implementation after the first local Web prototype
  - checking what Web code landed, what was verified, and what remains deferred
  - planning the next Web Console MVP stage
skip_when:
  - the task is only about shipped Telegram or Feishu pack behavior
  - the task needs only current product support truth
source_of_truth:
  - docs/plans/2026-04-26-web-first-phase-1-closeout.md
  - docs/plans/2026-04-26-web-first-pm-ledger.md
  - docs/roadmap/codex-console-continuation-brief.md
-->

# Codex Console Web-First Phase 1 Closeout

Status: phase closeout / next-stage tracker  
Owner: Hermes/Tuzi controller; Codex runs were implementation and review subagents  
Last updated: 2026-04-26

## Owner Goal Alignment

The product goal remains: **a browser Web端 that can access the owner’s Bridge and Codex state, then later operate Codex safely**.

Phase 1 deliberately landed the safety and read-only substrate first. It is not the final Web Console. It proves that a local, token-gated browser surface can read Bridge state through Web-safe ViewModels without leaking raw platform IDs, local paths, callbacks, terminal output, or action controls.

## What Landed

Phase 1 commits on `feat/codex-console-phase2`:

1. `61d2f10 feat: add Web-first read-only view-model seam`
2. `0a590f6 feat: add Web artifact descriptor view models`
3. `93fa360 feat: add Web read-only live provider seam`
4. `eee1273 feat: add local read-only Web shell module`
5. `bceff02 feat: add local Web readonly harness`
6. `6a77f8d feat: populate Web rows from scoped sessions`
7. `39f31cb feat: add Web readonly platform binding filter`

Implemented source areas:

- `src/service/web-readonly-view-model.ts` and tests: Web-safe read-only DTO/ViewModel layer for home, workspaces, conversations, results, artifacts, runtime, readiness, and pending interactions.
- `src/service/web-readonly-live-provider.ts` and tests: composition seam that scopes reads through a resolved operator binding.
- `src/web/readonly-access.ts`: denied-by-default bearer gate.
- `src/web/readonly-renderer.ts`: escaped, static, read-only HTML renderer.
- `src/web/readonly-http-server.ts` and tests: dependency-free local HTTP shell with generic 404/500, no-store/CSP/nosniff.
- `src/web/readonly-cli.ts` and tests: explicit local harness for `web readonly`, token requirement, localhost default, and platform-only binding filter.
- `src/cli.ts` and tests: CLI path wiring for the explicit local Web prototype command.

## Current Prototype Behavior

Development command shape:

```bash
CTB_WEB_READONLY_TOKEN=*** node --import tsx src/cli.ts web readonly --platform feishu --port 45679
```

Installed command intent after build/install:

```bash
CTB_WEB_READONLY_TOKEN=*** ctb web readonly --platform feishu
```

Observed controller smoke on current local state:

- Listened on `127.0.0.1` only.
- Unauthenticated `/` returned generic 404 with no state data.
- Authenticated `/` returned 200 HTML for `Codex Console Web prototype`.
- With `--platform feishu`, operator binding became available and `workspace_data_unavailable` disappeared.
- Security headers included no-store/CSP/nosniff.
- Smoke server was killed after proof.

## Verification

Latest controller verification before closeout:

```bash
node --import tsx --test src/web/readonly-cli.test.ts src/service/web-readonly-live-provider.test.ts src/service/web-readonly-view-model.test.ts src/web/readonly-http-server.test.ts
npm run check
git diff --check
```

Result: all passed; Web-focused test subset passed with 35 tests.

Full-suite verification should be run before PR merge or release:

```bash
npm test
npm run check
npm run build
git diff --check
```

## Explicit Non-Claims

Do not claim any of these yet:

- Web is shipped, supported, public, mobile-ready, or service-enabled.
- Web replaces Telegram/Feishu.
- Browser users can submit Codex tasks, answer approvals, interrupt, upload/download, switch/resume, or access raw terminal/logs.
- External URL exposure is safe.

## Scratch Artifact Policy

`.hermes/` status files from Codex runs were process scratch. Their durable conclusions are summarized here and in `docs/plans/2026-04-26-web-first-pm-ledger.md`. They should stay out of product commits and can be removed after closeout.

## Next Stage: Web Console MVP

Next stage should move from local substrate toward an owner-reviewable Web Console experience while preserving gates.

### Phase 2A — Owner-Reviewable Read-Only Web Proof

Goal: produce a visual proof artifact the owner can inspect from chat without opening a public URL.

Tasks:

1. Create a deterministic screenshot/recording harness for the local read-only Web prototype.
2. Capture phone-width and desktop-width proof of:
   - Web Home;
   - workspace list;
   - workspace conversations;
   - conversation result metadata;
   - runtime/readiness/degraded states.
3. Add a small proof runbook under docs or operations if the command sequence becomes non-trivial.
4. Verify proof contains no raw IDs, tokens, local paths, callback data, terminal/log output, or action controls.

Acceptance:

- Owner can visually judge whether this looks like the intended Web Console direction.
- No URL exposure is required.
- No new write/action capability is introduced.

### Phase 2B — Useful Read-Only Data Depth

Goal: make the read-only pages genuinely useful before external exposure.

Candidate tasks:

1. Persist or derive Web-safe final-answer bodies separately from Telegram/Feishu delivery HTML.
2. Improve conversation detail so completed results are readable without exposing raw delivery artifacts.
3. Improve runtime/readiness labels for owner comprehension.
4. Preserve artifact descriptors as handles only; defer preview/download until separate gates.

Acceptance:

- Owner can open a conversation and understand the final result and status.
- No raw protocol/message/platform payloads leak.

### Phase 2C — Protected Owner URL Gate

Goal: design and implement temporary protected access for owner phone validation.

Prerequisites:

- Phase 2A screenshots/recordings accepted.
- Read-only pages have useful data depth.
- Explicit auth/session design is approved.

Non-goals until approved:

- public unauthenticated URL;
- service autostart as default;
- multi-user/team access;
- actions or task submission.

### Phase 2D — Controlled Actions Later

Only after the read-only owner flow is accepted:

1. Submit a simple text task.
2. Observe lifecycle and final result.
3. Answer one approval/question class.
4. Interrupt with clear outcome.

Each action requires CSRF/action protection, audit trail, stale/duplicate/failure handling, and owner-visible recovery state.

## Tracking Board

| Lane | Status | Next artifact | Gate |
|---|---|---|---|
| Local read-only substrate | Done | This closeout + commits | Pushed branch / PR-ready |
| Screenshot/recording proof | Next | Media proof + optional runbook | Owner visual acceptance |
| Final-answer readable body | Next after proof or parallel | Web-safe body storage/display slice | No raw delivery artifact leak |
| Protected owner URL | Deferred | access design + reversible exposure plan | Auth/session approved |
| Controlled Codex actions | Deferred | separate action package | Security/audit gates approved |

## Recovery Commands

```bash
cd /tmp/codex-console-phase2
git status --short --branch
git log --oneline --max-count=8
npm test
npm run check
npm run build
git diff --check
```

Use this closeout plus the continuation brief before starting the next implementation run.
