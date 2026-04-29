<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
  - docs/plans/2026-04-26-product-web-console-mvp.md
  - docs/plans/2026-04-26-web-first-pm-ledger.md
  - docs/plans/2026-04-26-web-protected-owner-access-plan.md
  - docs/plans/2026-04-26-web-gated-actions-design.md
  - docs/plans/2026-04-26-feishu-official-capability-audit.md
  - docs/plans/2026-04-09-feishu-pack-setup-capability-and-hardening-plan.md
  - docs/plans/2026-04-08-multi-platform-core-and-feishu-implementation-plan.md
  - docs/plans/2026-03-30-binding-model-neutralization-note.md
  - docs/plans/2026-03-30-platform-binding-boundary-design.md
  - docs/plans/2026-03-30-platform-surface-adapter-and-capability-prep.md
  - docs/plans/2026-03-23-multi-platform-core-phase-1-implementation-plan.md
  - docs/plans/2026-03-23-multi-platform-core-pending-task-tracker.md
summary: router for active trackers, current implementation sequencing, and non-archived deferred work
read_when:
  - the request is about implementation sequencing, closeout status, or deferred work
  - the request needs historical planning context for the multi-platform Core slice
skip_when:
  - the request is only about current shipped behavior or future product direction
source_of_truth:
  - docs/plans/README.md
  - docs/roadmap/codex-console-continuation-brief.md
  - docs/plans
-->

# Plans Index

Use this directory for active sequencing, current closeout state, and deferred-work tracking.
It is planning context, not current product truth.
For new Codex Console continuation work, start with `../roadmap/codex-console-continuation-brief.md` before opening any dated plan.

## Active Or Recently Relevant Leaves

- `2026-04-26-product-web-console-mvp.md` - active Phase 3 Product Web Console MVP source for information architecture, read-only product UX acceptance criteria, final-answer source rules, runtime/pending copy, guardrails, and next implementation slices.
- `2026-04-26-web-first-pm-ledger.md` - detailed PM/controller ledger for the current PR branch, committed checkpoints, live owner-preview state, verification, monitor cleanup, and recovery details.
- `2026-04-26-web-protected-owner-access-plan.md` - protected owner-only access design gate for the local read-only Web prototype, including threat model, auth/session requirements, rollback drill, and acceptance checklist.
- `2026-04-26-web-gated-actions-design.md` - docs-only design gate for future Web submit, approval-answer, and interrupt actions after read-only MVP and protected owner access pass.
- `2026-04-26-feishu-official-capability-audit.md` - official-API-backed Feishu capability audit and live-smoke caveat.
- `2026-04-09-feishu-pack-setup-capability-and-hardening-plan.md` - Feishu setup, callback readiness, and first-run binding hardening backlog.
- `2026-04-08-multi-platform-core-and-feishu-implementation-plan.md` - completed platform abstraction / Feishu implementation plan kept temporarily because it still anchors current-pack follow-up context.
- March 23 / March 30 multi-platform Core, binding, and surface notes remain here only as short-term sequencing context for Core/platform-boundary follow-up.

## Archived Plan Material

Completed Phase 1/2 Web planning docs, the Phase 2 release note, and older implementation plans live under `../archive/plans/`.
They are not active task context and should only be opened for historical reconstruction.

## Skip This Directory When

- you need shipped behavior right now;
- the continuation brief plus one current-truth leaf is enough;
- the task is archaeology only, in which case use `../archive/plans/README.md` directly.
