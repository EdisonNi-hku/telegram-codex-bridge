<!-- docmeta
role: leaf
layer: 3
parent: docs/future/README.md
children: []
summary: future repository direction for a broader platform-neutral Core with Telegram as the first official pack
read_when:
  - the request is about the future multi-platform direction of the repository
  - the request needs the target split between Core, presentation, capability, and packs
skip_when:
  - the request is only about current shipped Telegram behavior or current implementation ownership
source_of_truth:
  - docs/future/multi-platform-core-prd.md
  - docs/product/v1-scope.md
  - docs/architecture/runtime-and-state.md
  - src/core
-->

# Multi-Platform Codex Bridge Core PRD

Status: Active future direction
Owner: Product / Architecture
Last updated: 2026-03-23

Current truth remains Telegram-first.
This file describes where the repository should go next, not what it ships today.

## What This Covers

This document answers three questions:

- what the repository should become beyond the current Telegram bridge
- which responsibilities belong in a shared Core versus platform-specific packs
- how to grow beyond Telegram without pretending the current product is already multi-platform

## Current Baseline On 2026-03-23

Today the shipped product is still:

- a single-user Telegram control surface
- one local long-lived `codex app-server` child over `stdio`
- one SQLite state store
- a runtime, interaction, and final-answer UX shaped around Telegram concepts

Important nuance:

- the protocol wrapper already exposes a broader surface than Telegram currently uses
- the first internal `Domain + Workflow + Interaction Model` seam has landed under `src/core/`
- that seam is useful groundwork, but it is not yet a platform-neutral product core

## Product Goal

The repository should evolve from:

- a Telegram bridge for Codex

to:

- a **Codex Bridge Core** that can power multiple control surfaces, with Telegram as the first official platform pack

The point is shared semantics, not forced UX parity.
Slack, Discord, Telegram, and a future Web or App console can look different while still sharing the same session, turn, interaction, runtime, and final-answer meaning.

## Selected Future Model

| Layer | Owns | Must not own |
|---|---|---|
| Domain | bridge session, turn, pending interaction, runtime notice, final-answer view, project-selection context | Telegram message ids or transport formatting |
| Workflow | start or resume session, start turn, continue blocked turn, approvals, questionnaires, runtime reduction, finalization, recovery | concrete platform rendering |
| Interaction Model | picker, approval, questionnaire, paginated view, runtime panel, final-answer preview, recovery notice | Telegram button layouts or callback payloads |
| Capability | whether a platform supports buttons, edits, uploads, previews, or long-form pagination | business workflow decisions |
| Presentation | Telegram, Slack, Discord, Web, or App rendering | Core workflow ownership |
| Pack And Skill | transport glue, auth, ingress, egress, install, repair, upgrade, verification | shared product semantics that multiple platforms need |

## Relationship To Telegram

Telegram remains:

- the current shipped product surface
- the first official platform pack
- the reference surface for rich remote-control UX

Telegram should not remain:

- the long-term repository boundary
- the hidden default architecture for every future surface
- the place where shared bridge semantics are invented first

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
- Telegram as the first explicit pack
- future chat-platform packs
- a future Web or App console
- skill-driven distribution for packs

Out of scope for this direction:

- claiming current multi-platform support
- changing shipped Telegram behavior by documentation alone
- forcing identical UX across every platform
- renaming the repository, package, or CLI in this docs phase
- turning skills into the runtime architecture

## Milestone Read As Of 2026-03-23

1. Document the future Core direction without rewriting current truth: complete.
2. Separate platform-neutral workflow and interaction concepts from Telegram-owned delivery concepts: started and materially landed.
3. Make Telegram the first explicit platform pack: future work.
4. Add a second pack or a Web/App console after the Core boundary holds: future work.

## Success Checks

This direction is working when:

- current truth and future direction stay clearly separated in docs and AGENTS routing
- future work can answer "is this Core, Capability, Presentation, or Pack?" without hand-waving
- a second platform no longer needs to reinvent session, interaction, and delivery semantics
- a future Web or App console can reuse the same workflow and interaction model instead of bypassing bridge logic
