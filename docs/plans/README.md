<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
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
  - docs/plans/2026-03-23-multi-platform-core-phase-1-implementation-plan.md
  - docs/plans/2026-03-23-multi-platform-core-pending-task-tracker.md
  - docs/plans
-->

# Plans Index

Use this directory for sequencing, closeout status, and deferred-work tracking.
It is planning context, not current product truth.

## Open One Leaf

- `2026-04-09-feishu-pack-setup-capability-and-hardening-plan.md` - capability definition and prioritized hardening backlog for making Feishu setup, callback readiness, and first-run binding work as one operator-safe flow.
- `2026-04-08-multi-platform-core-and-feishu-implementation-plan.md` - executable 4-phase backlog that finishes platform abstraction by Phase 3 and lands Feishu as the second platform in Phase 4.
- `2026-03-30-binding-model-neutralization-note.md` - current note for neutralizing auth and chat binding model fields without claiming multi-platform support.
- `2026-03-30-platform-binding-boundary-design.md` - current boundary note for separating platform principal, surface target, and bridge session ownership.
- `2026-03-30-platform-surface-adapter-and-capability-prep.md` - current predesign note for the next platform-surface adapter and capability slice.
- `2026-03-23-multi-platform-core-phase-1-implementation-plan.md` - what the first abstraction wave landed, how it was scoped, and why it stopped where it did.
- `2026-03-23-multi-platform-core-pending-task-tracker.md` - the original Phase-1 deferred-work baseline; use it as historical sequencing context, not as the current status page.

## Other Useful Plan Files

- `2026-03-18-v5-5-post-v5-slimming-plan.md` - active V5.5 cleanup tracker.
- `2026-03-23-performance-monitoring-plan.md` - performance monitoring implementation notes.
- older date-stamped files in this directory - historical implementation context only.

## Skip This Directory When

- you need the shipped behavior right now
- you need future product direction rather than implementation sequencing
