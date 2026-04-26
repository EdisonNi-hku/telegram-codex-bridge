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

## Next Gates

1. Checkpoint the live provider seam plus this PM ledger.
2. Continue with narrow groundwork only until an owner-visible Web shell milestone is intentionally started.
3. Next possible coding lanes may include minimal denied-by-default local shell planning/implementation, persisted neutral final-answer bodies, or readiness model refinement; do not add publicly reachable routes, owner URL, action controls, uploads/downloads, or support claims without an explicit controller gate.

## Guardrails

Do not claim Web is shipped, supported, enabled, public, or browser-usable yet.

Still not implemented:

- Web routes.
- UI/pages/components.
- Auth/session binding.
- Server or protected URL.
- Screenshot harness/mobile evidence.
- Task submission.
- Approval/question answering.
- Interrupt.
- Uploads/downloads.
- Switch/resume controls.
- Multi-user/team features.
- Native App.

