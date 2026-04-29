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
  - docs/roadmap/codex-console-continuation-brief.md
  - docs/catalog.yaml
-->

# Documentation Map

Use this file when you want the human-readable version of the doc tree.
If you are starting a new Codex Console continuation task, open `docs/roadmap/codex-console-continuation-brief.md` first.

## Start With Truth Status

- Active continuation handoff: `docs/roadmap/codex-console-continuation-brief.md`
- Current behavior: `docs/product/`, `docs/architecture/`, `docs/operations/`, and `docs/generated/current-snapshot.md`
- Protocol capability only: `docs/research/`
- Future direction: `docs/future/`
- Active plans and closeout notes: `docs/plans/`
- Historical reconstruction only: `docs/archive/`

## Fast Paths

- New Codex Console / multi-platform bridge continuation work: `docs/roadmap/codex-console-continuation-brief.md`
- Current Codex Console product boundary: `docs/product/v1-scope.md`
- Current bridge-versus-platform decoupling progress: `docs/architecture/platform-decoupling-status.md`
- Current pack boundary, active-pack behavior, or platform capability split: `docs/architecture/platform-pack-boundary.md`
- Current Telegram/Feishu capability matrix and future Web/App target rows: `docs/architecture/platform-capability-matrix.md`
- Install, active-pack selection, config, service, update, diagnostics: `docs/operations/install-and-admin.md`
- Exact Codex app-server capability or payload shape: `docs/research/README.md`
- Future Codex Bridge Core direction: `docs/future/multi-platform-core-prd.md`
- Future Web/App control surface sketch: `docs/future/web-app-control-surface-sketch.md`
- Web-first MVP scope/readiness and VPS/mobile validation gates: `docs/future/web-mvp-scope-and-readiness.md`
- Future Web prototype protected URL and mobile-access security plan: `docs/operations/web-vps-mobile-access-and-security.md`
- Web/App pre-implementation contract and readiness gates: `docs/architecture/web-app-preimplementation-contract.md`
- Phase 2 summary / PR note: `docs/plans/2026-04-26-codex-console-phase2-release-note.md`

## Rules That Matter

- Use the continuation brief to decide what not to read.
- Current docs and current code beat plans.
- Protocol evidence proves capability, not shipped Telegram UX.
- Future and plan docs are intent and sequence, not current behavior.
- Archived docs should not enter model context unless the task asks for history or current sources conflict.
- Read one entrypoint, then one leaf, then stop.

## Agent Path

Coding agents should usually take the smaller route:

1. `AGENTS.md`
2. one domain router such as `docs/AGENTS.md` or `src/AGENTS.md`
3. one leaf doc or one narrow source file

For continuation work, the leaf is usually `docs/roadmap/codex-console-continuation-brief.md` plus one current-truth doc.
