<!-- docmeta
role: entry
layer: 1
parent: null
children:
  - docs/roadmap/codex-console-continuation-brief.md
  - docs/product/README.md
  - docs/architecture/README.md
  - docs/operations/README.md
  - docs/generated/current-snapshot.md
  - docs/research/README.md
  - docs/future/README.md
  - docs/plans/README.md
  - docs/roadmap/README.md
  - docs/archive/README.md
summary: canonical documentation router that separates active task handoff, current truth, protocol evidence, and future or historical context
read_when:
  - need the canonical docs router
  - starting a new Codex Console continuation task without a known leaf
skip_when:
  - the exact active brief, domain, or leaf is already known
source_of_truth:
  - docs/INDEX.md
  - docs/roadmap/codex-console-continuation-brief.md
  - docs/catalog.yaml
-->

# Docs Index

The docs tree is organized by decision value and context cost.
Open one entrypoint, then one leaf, then stop.

## Active Continuation Entrypoint

- `docs/roadmap/codex-console-continuation-brief.md` - start here for new Codex Console / multi-platform bridge continuation work. It names the active source set, archive policy, and next sustainable task queue.

## Current Truth

- `docs/product/README.md` - current Codex Console product behavior, including Telegram-first scope, commands, and callback UX.
- `docs/architecture/README.md` - current runtime shape, bridge-versus-platform decoupling status, state model, pack boundary, capability matrix, and code ownership.
- `docs/operations/README.md` - install, active-pack selection, config, service, update, and diagnostics.
- `docs/generated/current-snapshot.md` - exact version baselines and other high-drift facts.

## Protocol Evidence

- `docs/research/README.md` - Codex app-server capability, method shapes, and verification notes.

## Future, Planning, And History

- `docs/future/README.md` - future product and architecture direction, including the broader Codex Bridge Core path and Web/App control surface sketch.
- `docs/plans/README.md` - active trackers, implementation sequencing, and closeout notes.
- `docs/roadmap/README.md` - delivery ordering, continuation handoff, and acceptance intent.
- `docs/archive/README.md` - historical material only when current sources conflict.

## Guardrails

- Start with the continuation brief for new platform-abstraction work; do not start with old dated plans.
- Current docs and current code beat plan docs.
- Research docs prove protocol capability, not shipped Telegram support.
- Future docs describe direction, not the product you have today.
- Archived docs are for archaeology, not default agent context.
- If you already know the leaf, skip this file.
