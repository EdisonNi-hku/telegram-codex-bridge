<!-- docmeta
role: domain
layer: 2
parent: docs/INDEX.md
children:
  - docs/research/codex-app-server-authoritative-reference.md
  - docs/research/codex-app-server-api-quick-reference.md
  - docs/research/app-server-phase-0-verification.md
summary: router for Codex app-server protocol evidence and verification material
read_when:
  - the request is about Codex app-server capability or exact protocol shapes
  - the request needs protocol evidence separate from shipped Telegram behavior
skip_when:
  - the request is only about current product behavior or implementation ownership
source_of_truth:
  - docs/research/README.md
  - docs/research
-->

# Research Index

Use this directory only when the question is about protocol capability or exact payload shape.
It is evidence, not shipped-product proof.

## Open One Leaf

- `codex-app-server-authoritative-reference.md` - full protocol reference.
- `codex-app-server-api-quick-reference.md` - fast method lookup.
- `app-server-phase-0-verification.md` - earlier verification findings.

## Open Architecture Instead When

- you need the current bridge adoption boundary rather than raw protocol capability
- you need to know which methods, notifications, or server requests are actually wired into Telegram today

## Skip This Directory When

- you need current Telegram behavior
- you need current code ownership
- you only need future product direction without protocol detail
