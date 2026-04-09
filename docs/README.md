<!-- docmeta
role: entry
layer: 1
parent: null
children: []
summary: human-readable companion to the canonical docs router
read_when:
  - need a plain-English map of the docs tree
  - want fast reading paths without loading every directory
skip_when:
  - the canonical docs router or exact leaf is already known
source_of_truth:
  - docs/README.md
  - docs/INDEX.md
  - docs/catalog.yaml
-->

# Documentation Map

Use this file when you want the human-readable version of the doc tree.
If you want the canonical router, open `docs/INDEX.md`.

## Start With Truth Status

- Current behavior: `docs/product/`, `docs/architecture/`, `docs/operations/`, and `docs/generated/current-snapshot.md`
- Protocol capability only: `docs/research/`
- Future direction, sequencing, and history: `docs/future/`, `docs/plans/`, `docs/roadmap/`, and `docs/archive/`

## Fast Paths

- Current Telegram product boundary: `docs/product/v1-scope.md`
- Current runtime shape or ownership map: `docs/architecture/README.md`
- Current pack boundary, active-pack behavior, or platform capability split: `docs/architecture/platform-pack-boundary.md`
- Install, config, service, update, diagnostics: `docs/operations/install-and-admin.md`
- Exact Codex app-server capability or payload shape: `docs/research/README.md`
- Future multi-platform Core direction: `docs/future/multi-platform-core-prd.md`
- What landed in the 2026-03-23 abstraction wave and what is still deferred: `docs/plans/README.md`

## Rules That Matter

- Current docs and current code beat plans.
- Protocol evidence proves capability, not shipped Telegram UX.
- Future and plan docs are intent and sequence, not current behavior.
- Read one domain, then one leaf, then stop.

## Agent Path

Coding agents should usually take the smaller route:

1. `AGENTS.md`
2. one domain router such as `docs/AGENTS.md` or `src/AGENTS.md`
3. one leaf doc or one narrow source file
