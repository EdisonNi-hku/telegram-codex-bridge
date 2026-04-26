<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
  - docs/architecture/platform-decoupling-status.md
  - docs/architecture/runtime-and-state.md
  - docs/architecture/current-code-organization.md
  - docs/architecture/codex-app-server-adoption.md
  - docs/architecture/platform-pack-boundary.md
  - docs/architecture/platform-capability-matrix.md
  - docs/architecture/web-app-preimplementation-contract.md
summary: router for the current runtime shape, decoupling status, state model, verified code ownership map, pack boundary, capability matrix, app-server adoption boundary, and future Web/App pre-implementation contract
read_when:
  - the request is about current runtime lifecycle, state, recovery, or code ownership
  - the request needs the current implementation map before opening source files
skip_when:
  - the request is mainly about current Telegram UX, install/admin, or future Core direction
source_of_truth:
  - docs/architecture/README.md
  - docs/architecture/runtime-and-state.md
  - docs/architecture/platform-decoupling-status.md
  - docs/architecture/current-code-organization.md
  - docs/architecture/codex-app-server-adoption.md
  - docs/architecture/platform-pack-boundary.md
  - docs/architecture/platform-capability-matrix.md
  - docs/architecture/web-app-preimplementation-contract.md
  - src
-->

# Architecture Index

Use this directory for the current internal shape of the bridge.
This is still Telegram-first runtime truth, not future-Core intent.

## Open One Leaf

- `platform-decoupling-status.md` - current bridge-versus-platform separation status, including what has landed and what is still Telegram-shaped.
- `runtime-and-state.md` - service lifecycle, SQLite state, recovery rules, runtime surfaces, and final-answer delivery.
- `current-code-organization.md` - verified owner map after the Core seam and pack boundary landed.
- `codex-app-server-adoption.md` - current bridge-owned app-server lifecycle, request families, server-request handling, and notification reduction.
- `platform-pack-boundary.md` - current active-pack contract, runtime factory, health checks, and Telegram vs Feishu ownership split.
- `platform-capability-matrix.md` - current Telegram/Feishu capability matrix, common product expectations, platform-specific features, and future Web/App target rows.
- `web-app-preimplementation-contract.md` - future Web/App Core/state/API contract and readiness gates that must be used before any Web/App implementation begins.

## Skip This Directory When

- you need current user-facing Telegram behavior
- you need install or admin procedures
- you need future multi-platform direction instead of today's implementation shape
