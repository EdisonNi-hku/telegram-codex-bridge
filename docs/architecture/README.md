<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
  - docs/architecture/runtime-and-state.md
  - docs/architecture/current-code-organization.md
  - docs/architecture/codex-app-server-adoption.md
summary: router for the current runtime shape, state model, verified code ownership map, and app-server adoption boundary
read_when:
  - the request is about current runtime lifecycle, state, recovery, or code ownership
  - the request needs the current implementation map before opening source files
skip_when:
  - the request is mainly about current Telegram UX, install/admin, or future Core direction
source_of_truth:
  - docs/architecture/README.md
  - docs/architecture/runtime-and-state.md
  - docs/architecture/current-code-organization.md
  - docs/architecture/codex-app-server-adoption.md
  - src
-->

# Architecture Index

Use this directory for the current internal shape of the bridge.
This is still Telegram-first runtime truth, not future-Core intent.

## Open One Leaf

- `runtime-and-state.md` - service lifecycle, SQLite state, recovery rules, runtime surfaces, and final-answer delivery.
- `current-code-organization.md` - verified owner map after the 2026-03-23 Core seam landed under `src/core/`.
- `codex-app-server-adoption.md` - current bridge-owned app-server lifecycle, request families, server-request handling, and notification reduction.

## Skip This Directory When

- you need current user-facing Telegram behavior
- you need install or admin procedures
- you need future multi-platform direction instead of today's implementation shape
