<!-- docmeta
role: leaf
layer: 3
parent: docs/architecture/README.md
children: []
summary: current pack boundary for active-pack selection, runtime factory ownership, platform capabilities, and Telegram vs Feishu split
read_when:
  - the request is about the current pack abstraction rather than the future Core direction
  - the request is about active pack selection, pack health, or Telegram vs Feishu ownership
  - current implementation includes pack-aware behavior that should not be confused with shipped Telegram-first product truth
skip_when:
  - the request is only about current Telegram UX
  - the request is only about raw protocol capability
source_of_truth:
  - pack-manifest.json
  - src/config.ts
  - src/runtime.ts
  - src/readiness.ts
  - src/install.ts
  - src/packs/contract.ts
  - src/packs/catalog.ts
  - src/packs/registry.ts
  - src/packs/telegram
  - src/packs/feishu
  - src/service.ts
-->

# Platform Pack Boundary

Verified against the current implementation on 2026-04-09.

Use this file for the answer to:

- what the current pack abstraction actually owns today
- how `activePack` changes install, readiness, skill install, and runtime startup
- where Telegram ends and Feishu-specific ownership begins in the current codebase
- how to extend current pack-aware behavior without claiming that the product is already fully platform-neutral

This file is about the current implementation boundary.
It is not the future multi-platform product PRD.

## Current Truth In One Screen

- the repository now has a real pack contract under `src/packs/`
- `BRIDGE_PACK` selects the active pack at config load time; default is still `telegram`
- runtime startup, readiness checks, install-time skill selection, and dynamic tool declarations are pack-aware
- the shared service shell is still largely Telegram-shaped
- Feishu support exists as a current runtime and setup boundary, but that does not override the repo's Telegram-first shipped-product docs

That means two statements are true at the same time:

- current implementation is no longer purely Telegram-hardcoded
- current default product truth should still be read as Telegram-first unless the task is explicitly about pack internals or Feishu setup

## What The Pack Contract Owns

`src/packs/contract.ts` defines the current pack seam.
Each pack supplies:

- identity and display metadata
- a capability snapshot for inbound and outbound surface behavior
- ingress and egress ownership
- auth-binding rules
- install-time validation and control-surface sync policy
- pack-specific dynamic tools and server-request interpretation
- pack health checks
- a runtime factory

Today this seam is concrete enough for:

- picking the active runtime at startup
- changing readiness output and admin health by pack
- selecting the bundled Codex skill for install and GitHub shortcuts
- exposing pack-specific control-surface tools

It is not yet a full replacement for the shared bridge shell.

## Active-Pack Control Flow

Current pack-aware flow:

1. `src/config.ts` reads `BRIDGE_PACK` plus pack-specific env into the shared config object.
2. `src/runtime.ts` resolves the active pack through `getActiveBridgePack(config)`.
3. the selected pack creates the runtime and contributes capability declarations.
4. `src/readiness.ts` runs shared checks plus the active pack's health checks.
5. `src/install.ts` uses the active pack for install validation, skill installation, and status output.

Current install-facing implications:

- `ctb install` accepts `--pack <name>` and repeated `--pack-option key=value`
- `ctb install-skill` also accepts `--pack <name>`
- GitHub install shortcuts resolve the pack through `pack-manifest.json` and forward it into the CLI

## Current Owner Split

Pack-neutral owner files:

- `src/packs/contract.ts` - the interface a pack must satisfy
- `src/packs/catalog.ts` - supported pack list, display names, skill names, and config codecs
- `src/packs/registry.ts` - active-pack lookup and runtime selection
- `src/config.ts` - shared config plus pack-specific env serialization
- `src/runtime.ts` - top-level runtime handoff into the selected pack
- `src/readiness.ts` - shared readiness plus pack health integration
- `src/install.ts` - pack-aware install, update, status, and skill install behavior

Telegram pack owners:

- `src/packs/telegram/index.ts` - Telegram pack definition, health checks, dynamic tools, and control-surface sync
- `src/packs/telegram/config.ts` - Telegram pack env/config codec
- `src/telegram/` - current Telegram API, poller, commands, and UI rendering

Feishu pack owners:

- `src/packs/feishu/index.ts` - Feishu pack definition, health checks, setup-health wiring, and dynamic tools
- `src/packs/feishu/config.ts` - Feishu pack env/config codec
- `src/packs/feishu/setup.ts` - Feishu setup-cycle observation and readiness interpretation
- `src/feishu/` - current Feishu API and polling compatibility adapters

Shared shell owners that are still not fully pack-neutral:

- `src/service.ts`
- broad parts of `src/service/`
- persistence and many product-facing docs that still describe Telegram-first UX

## Capability And Tooling Boundary

Current pack capability snapshots are used for platform-sensitive decisions such as:

- callback support
- edit support
- rich preview and pagination support
- whether the control surface can send or receive images, files, and voice

Current dynamic-tool boundary:

- Telegram pack declares `send_telegram_document` and `send_telegram_image`
- Feishu pack declares `send_feishu_file` and `send_feishu_image`
- shared server-request interpretation still handles the common approval and interaction families first
- pack-specific interpretation handles only the platform-sensitive remainder

## What Is Safe To Change Here

Usually safe:

- add or refine pack health checks
- add pack-specific install/config codecs
- extend pack metadata or capability snapshots
- add a new pack-owned dynamic tool when the target surface really supports it

Needs extra caution:

- changing `BridgePackDefinition` in ways that ripple into `src/service.ts`, readiness, and install
- claiming a pack capability in docs before the corresponding runtime and UI path exist
- treating Feishu setup coverage as proof that Telegram-first product docs no longer apply

Escalate to the future-direction docs when the change is about a fully platform-neutral product core rather than today's pack-aware runtime boundary.
