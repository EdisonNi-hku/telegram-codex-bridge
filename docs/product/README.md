<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
  - docs/product/v1-scope.md
  - docs/product/chat-and-project-flow.md
  - docs/product/auth-and-project-flow.md
  - docs/product/codex-command-reference.md
  - docs/product/runtime-and-delivery.md
  - docs/product/callback-contract.md
summary: router for current Telegram-first product behavior and user-facing command surfaces
read_when:
  - the request is about current user-facing Telegram behavior
  - the request is about v1 scope, command UX, or callback behavior
skip_when:
  - the request is mainly about code ownership, install/admin, or future Core direction
source_of_truth:
  - docs/product/README.md
  - docs/product/v1-scope.md
  - docs/product/chat-and-project-flow.md
  - docs/product/auth-and-project-flow.md
  - docs/product/codex-command-reference.md
  - docs/product/runtime-and-delivery.md
  - docs/product/callback-contract.md
-->

# Product Index

Use this directory for current Telegram-first product behavior.
Do not use it for future Core direction.

## Open One Leaf

- `v1-scope.md` - scope, trust model, and hard out-of-scope boundaries.
- `chat-and-project-flow.md` - the smallest router for picking the right Telegram UX doc.
- `auth-and-project-flow.md` - authorization, project picker, session flow, and browse behavior.
- `codex-command-reference.md` - Codex-backed commands and structured rich-input flows.
- `runtime-and-delivery.md` - runtime hubs/cards, inspect and status surfaces, and final-answer delivery.
- `callback-contract.md` - callback payload families, encoding rules, and stale-callback behavior.

## Skip This Directory When

- you need current code ownership or runtime internals
- you need install or diagnostics behavior
- you need the future multi-platform Core direction
