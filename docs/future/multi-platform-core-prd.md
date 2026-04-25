<!-- docmeta
role: leaf
layer: 3
parent: docs/future/README.md
children: []
summary: future product direction for Codex Console and Codex Bridge Core with Telegram as the stable first pack
read_when:
  - the request is about the future multi-platform direction of the repository
  - the request needs the target split between Core, presentation, capability, and packs
skip_when:
  - the request is only about current shipped Telegram behavior or current implementation ownership
source_of_truth:
  - docs/future/multi-platform-core-prd.md
  - docs/product/v1-scope.md
  - docs/architecture/runtime-and-state.md
  - docs/architecture/platform-capability-matrix.md
  - src/core
-->

# Codex Console And Codex Bridge Core PRD

Status: Active future direction
Owner: Product / Architecture
Last updated: 2026-04-25

Naming policy:

- external product name: **Codex Console**
- internal architecture name: **Codex Bridge Core**
- repository/package compatibility name: `telegram-codex-bridge`
- stable first platform pack: Telegram
- serious current platform pack: Feishu

Current truth remains Telegram-first by history and default install path, with current pack-aware Telegram and Feishu support.
This file describes product and architecture direction, not proof that every surface is fully platform-neutral today.

## What This Covers

This document answers three questions:

- what Codex Console should become beyond the current Telegram-first bridge history
- which responsibilities belong in a shared Core versus platform-specific packs
- how to grow beyond Telegram and Feishu without pretending broad multi-platform maturity is already solved

## Current Baseline On 2026-04-25

Today the implementation is still:

- single-user and high-trust by default
- Telegram-first in its top-level service history and default setup path
- pack-aware for Telegram and Feishu
- one local long-lived `codex app-server` child over `stdio`
- one SQLite state store
- runtime, interaction, and final-answer flows that still contain Telegram-shaped concepts

Important nuance:

- the protocol wrapper already exposes a broader surface than Telegram currently uses
- the first internal `Domain + Workflow + Interaction Model` seam has landed under `src/core/`
- a current pack boundary exists for Telegram and Feishu
- those seams are useful and real, but not yet a fully platform-neutral product core

## Product Goal

The product should read externally as:

- **Codex Console**: a self-hosted chat control surface for the Codex installation already running on the operator's machine

The architecture should evolve internally as:

- a **Codex Bridge Core** that can power multiple control surfaces, with Telegram as the first official platform pack

The point is shared semantics, not forced UX parity.
Telegram, Feishu, future chat packs, and a future Web or App console can look different while still sharing the same session, turn, interaction, runtime, and final-answer meaning.

## Selected Future Model

| Layer | Owns | Must not own |
|---|---|---|
| Domain | bridge session, turn, pending interaction, runtime notice, final-answer view, project-selection context | Telegram message ids or transport formatting |
| Workflow | start or resume session, start turn, continue blocked turn, approvals, questionnaires, runtime reduction, finalization, recovery | concrete platform rendering |
| Interaction Model | picker, approval, questionnaire, paginated view, runtime panel, final-answer preview, recovery notice | Telegram button layouts or callback payloads |
| Capability | whether a platform can support buttons, edits, uploads, previews, or long-form pagination | business workflow decisions |
| Presentation | Telegram, Slack, Discord, Web, or App rendering | Core workflow ownership |
| Pack And Skill | transport glue, auth, ingress, egress, install, repair, upgrade, verification | shared product semantics that multiple platforms need |

## Relationship To Telegram

Telegram remains:

- the stable first product surface
- the default install path
- the first official platform pack
- the reference surface for rich remote-control UX

Telegram should not remain:

- the long-term repository boundary
- the hidden default architecture for every future surface
- the place where shared bridge semantics are invented first

## Relationship To Feishu

Feishu is:

- a serious current platform pack
- evidence that pack-aware runtime and setup boundaries are real
- a second surface with its own constraints, not a clone of Telegram UX

Feishu is not:

- proof that broad multi-platform production maturity is complete
- a reason to erase the remaining Telegram-shaped service shell from current-truth docs
- a reason to force all future packs into Telegram or Feishu interaction patterns

## Capability Matrix

Use `../architecture/platform-capability-matrix.md` as the current planning table for Telegram, Feishu, and future Web/App target rows.
It translates implementation-level capability fields into owner-facing product expectations, UX richness tiers, ingress/egress rows, readiness levels, and new-platform decision rules.
Do not use the matrix to claim broad multi-platform maturity; use it to keep Core semantics and platform-specific affordances separated.

## Relationship To Skills

Skills should handle:

- install
- configuration
- repair
- upgrade
- end-to-end verification

Skills should not become:

- the substitute for Core abstraction
- the primary home of shared workflow semantics
- the only source of truth for platform capability

## Scope Boundaries

In scope for this direction:

- a platform-neutral bridge architecture
- Codex Console as the external product name
- Codex Bridge Core as the internal shared architecture name
- Telegram as the stable first explicit pack
- Feishu as a serious current pack
- future chat-platform packs
- a future Web or App console
- skill-driven distribution for packs

Out of scope for this direction:

- claiming broad multi-platform production maturity
- changing shipped Telegram behavior by documentation alone
- forcing identical UX across every platform
- renaming the repository, package, or CLI in this docs phase
- turning skills into the runtime architecture

## Milestone Read As Of 2026-04-25

1. Document the future Core direction without rewriting current truth: complete.
2. Separate platform-neutral workflow and interaction concepts from Telegram-owned delivery concepts: started and materially landed.
3. Make Telegram the first explicit platform pack: materially landed in the current pack boundary.
4. Add Feishu as a serious current platform pack: materially landed, while hardening remains tracked separately.
5. Add more packs or a Web/App console only after the Core boundary holds.

## Success Checks

This direction is working when:

- current truth and future direction stay clearly separated in docs and AGENTS routing
- future work can answer "is this Core, Capability, Presentation, or Pack?" without hand-waving
- a second platform no longer needs to reinvent session, interaction, and delivery semantics
- a future Web or App console can reuse the same workflow and interaction model instead of bypassing bridge logic
