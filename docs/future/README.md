<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
  - docs/future/multi-platform-core-prd.md
  - docs/future/web-app-control-surface-sketch.md
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/architecture/web-app-preimplementation-contract.md
summary: router for future Codex Console product direction, Codex Bridge Core architecture intent, Web MVP scope/readiness, and Web/App pre-implementation contract handoff
read_when:
  - the request is about future product direction rather than current shipped behavior
  - the request is about the broader Codex Bridge Core direction
skip_when:
  - the request is about current Telegram-first behavior or current code ownership
source_of_truth:
  - docs/future/README.md
  - docs/future/multi-platform-core-prd.md
  - docs/future/web-app-control-surface-sketch.md
  - docs/future/web-mvp-scope-and-readiness.md
  - docs/architecture/web-app-preimplementation-contract.md
-->

# Future Index

Use this directory for future direction only.
It does not override current truth: Codex Console is Telegram-first by default path, Feishu is a serious current pack, and broad multi-platform maturity is not yet claimed.

## Open One Leaf

- `multi-platform-core-prd.md` - product and architecture direction for Codex Console powered by Codex Bridge Core, with Telegram as the stable first pack and Feishu as a serious current pack.
- `web-app-control-surface-sketch.md` - future design sketch for a richer Web/App control surface that reuses Codex Bridge Core without claiming current Web/App support.
- `web-mvp-scope-and-readiness.md` - approved Web-first, App-later MVP scope, read-mostly first lane, readiness model, VPS/mobile validation path, and support-claim gates.
- `../architecture/web-app-preimplementation-contract.md` - contract-pass output with neutral Core/state/API surfaces and readiness gates required before any Web/App implementation begins.

## Archived Future Material

Older V2/V3 PRDs and engineering-evaluation files moved to `docs/archive/future/`. Do not read them for current continuation work unless reconstructing history.

## Skip This Directory When

- you need current shipped behavior
- you need current runtime ownership or install behavior
- you need protocol evidence rather than product direction
