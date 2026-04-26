<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
  - docs/plans/2026-04-26-web-viewmodel-inventory.md
  - docs/plans/2026-04-26-web-readonly-prototype-implementation-plan.md
  - docs/plans/2026-04-26-web-first-phase-1-closeout.md
  - docs/plans/2026-04-26-web-first-pm-ledger.md
  - docs/plans/2026-04-26-web-first-project-command-board.md
  - docs/plans/2026-04-26-web-mvp-controller-triage.md
  - docs/plans/2026-04-26-codex-console-phase2-release-note.md
  - docs/plans/2026-04-26-codex-console-phase2-plan.md
  - docs/plans/2026-04-26-feishu-official-capability-audit.md
  - docs/plans/2026-04-09-feishu-pack-setup-capability-and-hardening-plan.md
  - docs/plans/2026-04-08-multi-platform-core-and-feishu-implementation-plan.md
  - docs/plans/2026-03-30-binding-model-neutralization-note.md
  - docs/plans/2026-03-30-platform-binding-boundary-design.md
  - docs/plans/2026-03-30-platform-surface-adapter-and-capability-prep.md
  - docs/plans/2026-03-23-multi-platform-core-phase-1-implementation-plan.md
  - docs/plans/2026-03-23-multi-platform-core-pending-task-tracker.md
summary: router for active trackers, implementation sequencing, and closeout notes
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

Use this directory for active sequencing, closeout status, and deferred-work tracking.
It is planning context, not current product truth.
For new continuation work, start with `../roadmap/codex-console-continuation-brief.md` before opening any dated plan.

## Active Or Recently Relevant Leaves

- `2026-04-26-web-viewmodel-inventory.md` - implementation-facing inventory of read-only Core/state/source facades, the landed first adapter seam, and remaining read-only gaps for the future Web prototype.
- `2026-04-26-web-readonly-prototype-implementation-plan.md` - PM-readable guardrails and future-work route for the read-only Web prototype; the first service adapter seam has landed, while routes/UI/auth/actions remain unimplemented.
- `2026-04-26-web-first-phase-1-closeout.md` - closeout and next-stage tracker for the landed local read-only Web prototype, including commits, verification, smoke proof, and Phase 2A/2B/2C task lanes.
- `2026-04-26-web-first-pm-ledger.md` - detailed PM/controller ledger for delegated Codex runs, smoke evidence, and guardrails; use after the closeout only when detailed process history is needed.
- `2026-04-26-web-first-project-command-board.md` - PM command board for the Web-first continuation; closeout state points to prototype planning, not completed W2/W5 work.
- `2026-04-26-web-mvp-controller-triage.md` - controller-approved Web MVP scope cut that keeps the first lane read-mostly and Web-only.
- `2026-04-26-codex-console-phase2-release-note.md` - PR-ready summary of the install path, Feishu audit, metadata cleanup, Web/App sketch, and verification work.
- `2026-04-26-codex-console-phase2-plan.md` - phase plan for the Phase 2 continuation branch.
- `2026-04-26-feishu-official-capability-audit.md` - official-API-backed Feishu capability audit and live-smoke caveat.
- `2026-04-09-feishu-pack-setup-capability-and-hardening-plan.md` - Feishu setup, callback readiness, and first-run binding hardening backlog.
- `2026-04-08-multi-platform-core-and-feishu-implementation-plan.md` - four-phase backlog that completed platform abstraction and landed Feishu as the second platform.
- `2026-03-30-binding-model-neutralization-note.md` - neutralizing auth and chat binding model fields without claiming broad multi-platform support.
- `2026-03-30-platform-binding-boundary-design.md` - platform principal, surface target, and bridge session ownership boundary.
- `2026-03-30-platform-surface-adapter-and-capability-prep.md` - platform-surface adapter and capability vocabulary predesign.
- `2026-03-23-multi-platform-core-phase-1-implementation-plan.md` - first abstraction wave closeout and scope boundary.
- `2026-03-23-multi-platform-core-pending-task-tracker.md` - original Phase-1 deferred-work baseline; historical sequencing context only.

## Archived Plan Material

Older March implementation plans moved to `../archive/plans/`. They are not active task context and should only be opened for historical reconstruction.

## Skip This Directory When

- you need the shipped behavior right now
- you need future product direction rather than implementation sequencing
- the continuation brief plus one current-truth leaf is enough
