# Multi-Platform Codex Bridge Core PRD

Status: Active future direction
Owner: Product / Architecture
Last updated: 2026-03-23
Related docs:
- `docs/product/v1-scope.md`
- `docs/architecture/runtime-and-state.md`
- `docs/future/v3-prd.md`
- `docs/research/codex-app-server-authoritative-reference.md`

> Truth status:
> - Current truth? No
> - Use for: repository-level future direction
> - Verified current behavior here? No
> - Current shipped behavior remains Telegram-first unless current docs and code say otherwise

## 1. Purpose

This document defines the longer-term repository direction beyond the current Telegram-first bridge.

Its goal is to answer:
- what the repository should become after the current Telegram implementation
- how future platform support should be structured
- what should live in the Core versus in platform-specific packs and skills

This is a future product and architecture direction document.
It is not a current behavior spec and not an implementation plan.

## 2. Current Starting Point

Current shipped truth in this repository is:
- a single-user Telegram control plane
- one local long-lived `codex app-server` child
- one SQLite state store
- a Telegram-owned runtime, interaction, and final-answer UX
- bundled skills that currently focus on Telegram setup and repair

Current implementation also shows an important boundary:
- the Codex protocol wrapper already exposes a broader surface than the Telegram UX currently adopts
- the runtime shell, delivery surfaces, and persistence model are still strongly keyed to Telegram concepts such as chats, callback flows, and Telegram message ids
- the first internal `Domain + Workflow + Interaction Model` seam is now landed under `src/core/`, but it is still an internal boundary rather than a full multi-platform product core

Practical implication:
- the repo already has the beginning of a reusable protocol, workflow, and semantic-view core
- it does **not** yet have a platform-neutral product core

## 3. Product Goal

The repository should evolve from:
- a Telegram bridge for Codex

to:
- a **Codex Bridge Core** that can power multiple control surfaces, with Telegram as the first official platform pack

Target control surfaces for the next major direction:
- chat platforms such as Telegram, Slack, and Discord
- a future Web or App control console

This direction does **not** require all platforms to offer identical UX.
It requires them to share the same task, session, interaction, and delivery semantics wherever possible.

## 4. Selected Future Model

The future architecture should separate six layers:

### 4.1 Domain

Stable product objects and records:
- bridge session
- Codex thread
- turn
- pending interaction
- runtime notice
- final-answer view
- project selection context

This layer should describe the durable business objects, not Telegram-specific delivery details.

### 4.2 Workflow

Bridge-owned execution flows such as:
- start or resume a session
- start a turn
- continue a blocked turn
- handle approvals and questionnaires
- reduce runtime state
- finalize and recover delivery

This layer should own how work progresses, independent of how any platform renders it.

### 4.3 Interaction Model

Platform-neutral interaction semantics such as:
- picker
- approval
- questionnaire
- paginated view
- runtime panel
- final-answer preview and expand flow
- recovery notice

This layer is the contract between bridge logic and platform rendering.

### 4.4 Capability

Platform capability declaration such as:
- supports buttons or not
- supports message edit or not
- supports file upload or not
- supports media preview or not
- supports long-form paginated views or not

This layer decides fallback behavior instead of burying those choices inside each platform implementation.

### 4.5 Presentation

Render the interaction model into a concrete surface:
- Telegram renderer
- future Slack or Discord renderers
- future Web or App console renderer

This layer is where each platform can look different while preserving the same workflow semantics.

### 4.6 Pack And Skill

Platform-specific distribution and setup:
- platform pack provides transport, auth, ingress, and egress glue
- skill installs, configures, repairs, upgrades, and verifies that pack

Important rule:
- skills distribute and configure capability
- skills do **not** become the primary place where core workflow logic lives

## 5. Relationship To Telegram

Telegram remains:
- the current shipped product surface
- the first official platform pack
- the reference surface for rich remote-control UX

Telegram should **not** remain:
- the long-term repository boundary
- the only source of truth for future bridge architecture
- the place where every future control-surface decision is invented first

Future repository direction should therefore treat:
- current Telegram docs as current truth
- this document as future direction

Both are needed.
Neither should overwrite the other.

## 6. Relationship To Skills

The future role of skills is:
- install a platform pack
- configure credentials and environment
- run repair or update flows
- verify that the platform path works end-to-end

The future role of skills is **not**:
- to replace Core abstraction
- to carry product semantics that multiple platforms need
- to become the only source of truth for platform capability

NanoClaw-style skill-driven distribution is useful for this repository only when paired with a stronger internal Core than NanoClaw itself requires.

## 7. Scope Boundaries

In scope for this direction:
- platform-neutral bridge architecture
- Telegram as first pack
- future chat-platform packs
- future Web/App console
- skill-driven install and extension path for packs

Out of scope for this direction:
- claiming current multi-platform support
- changing current shipped Telegram behavior by documentation alone
- requiring 1:1 UX parity across every platform
- rewriting repository naming, package metadata, or public entrypoints in the current docs-only phase
- turning skills into the runtime architecture

## 8. Initial Milestone Direction

The intended future sequence is:

1. document the future Core direction without rewriting current truth
2. separate platform-neutral workflow and interaction concepts from Telegram-owned delivery concepts
3. make Telegram the first explicit platform pack
4. add one non-Telegram pack or one Web/App console after the Core boundary holds

This sequence is directional, not a locked implementation schedule.

Current milestone reading on 2026-03-23:

- step 1 is complete
- step 2 is started and now materially landed for the first internal abstraction wave
- steps 3 and 4 remain future work

## 9. Success Criteria

This future direction is successful when:
- current truth and future direction are clearly separated in docs and AGENTS routing
- future implementation work can ask “is this Core, Presentation, or Platform Pack?” and get a stable answer
- adding a second platform no longer requires re-inventing session, interaction, and delivery semantics from scratch
- a future Web/App console can reuse the same workflow and interaction model instead of bypassing bridge logic
