<!-- docmeta
role: entry
layer: 1
parent: null
children:
  - docs/product/README.md
  - docs/architecture/README.md
  - docs/operations/README.md
  - docs/research/README.md
  - docs/future/README.md
  - docs/plans/README.md
  - docs/roadmap/README.md
  - docs/archive/README.md
summary: canonical documentation router that separates current truth, protocol evidence, and future or historical context
read_when:
  - need the canonical docs router
  - need to choose one documentation domain before opening a leaf
skip_when:
  - the exact domain or leaf is already known
source_of_truth:
  - docs/INDEX.md
  - docs/README.md
  - docs/catalog.yaml
-->

# Docs Index

The docs tree is organized by decision value, not by folder trivia.
Open one domain, then one leaf, then stop.

## Current Truth

- `docs/product/README.md` - current Telegram-first product behavior, scope, commands, and callback UX.
- `docs/architecture/README.md` - current runtime shape, state model, and code ownership.
- `docs/operations/README.md` - install, config, service, update, and diagnostics.
- `docs/generated/current-snapshot.md` - exact version baselines and other high-drift facts.

## Protocol Evidence

- `docs/research/README.md` - Codex app-server capability, method shapes, and verification notes.

## Future, Planning, And History

- `docs/future/README.md` - future repository direction, including the broader Core path.
- `docs/plans/README.md` - active trackers, implementation sequencing, and closeout notes.
- `docs/roadmap/README.md` - delivery ordering and acceptance intent.
- `docs/archive/README.md` - historical material only when current sources conflict.

## Guardrails

- Current docs and current code beat plan docs.
- Research docs prove protocol capability, not shipped Telegram support.
- Future docs describe direction, not the product you have today.
- If you already know the leaf, skip this file.
