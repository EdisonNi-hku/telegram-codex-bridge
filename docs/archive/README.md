<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
  - docs/archive/plans/README.md
  - docs/archive/future/README.md
summary: router for archived historical material kept for reconstruction only
read_when:
  - the request needs historical reconstruction because current sources conflict
  - the request explicitly asks for archived material
skip_when:
  - current docs or code are enough to answer the question
source_of_truth:
  - docs/archive/README.md
  - docs/archive
-->

# Archive Index

Use this directory only when current sources are not enough.
Archive material is fallback context, not current truth.

## Typical Contents

- superseded drafts
- legacy PRDs and engineering evaluations
- closed implementation plans
- older notes kept for reconstruction

## Current Archive Groups

- `future/` - superseded V2/V3 future PRDs and evaluation material.
- `plans/` - older March implementation plans that should not be model context for current Codex Console continuation work.
- top-level archive files - older one-off historical notes that predate the current docs information architecture.

## Skip This Directory When

- current docs and code already answer the question
- you only need active product, architecture, operations, roadmap, or future-Core guidance
- you are preparing a new task prompt and have not yet read `../roadmap/codex-console-continuation-brief.md`
