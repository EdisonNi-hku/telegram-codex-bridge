<!-- docmeta
role: leaf
layer: 3
parent: docs/architecture/README.md
children: []
summary: verified owner map for the current src tree after the 2026-03-23 Core seam landed
read_when:
  - the request needs the current implementation map before opening source files
  - the request is about where ownership lives after the first internal Core abstraction wave
skip_when:
  - the request is only about user-facing Telegram behavior or future repository direction
source_of_truth:
  - docs/architecture/current-code-organization.md
  - src
-->

# Current Code Organization

Verified against the current `src/` tree on 2026-03-23.

Use this file to choose the right owner before opening code.
This is a code-derived map of what exists today, not a roadmap.

## 2026-03-23 Seam Summary

The important change from today's abstraction wave is simple:

- `src/core/` now owns the first internal multi-platform seam.
- `src/service/` adapts store rows, activity state, and app-server events into that seam.
- `src/telegram/ui-*.ts` renders Telegram-specific presentation.
- persistence, install/admin, and the shipped product surface are still intentionally Telegram-first.

That means the repo now has a reusable internal boundary.
It does not yet have a full platform-neutral product core.

## Start Here By Question

- current Core semantics: one narrow file under `src/core/domain/`, `src/core/interaction-model/`, or `src/core/workflow/`
- runtime startup and shell wiring: `src/service.ts`
- session or project flow: `src/service/session-project-coordinator.ts`
- project browsing: `src/service/project-browser-coordinator.ts`
- Codex-backed commands: `src/service/codex-command-coordinator.ts`
- rich inputs such as photos, voice, or structured mentions: `src/service/rich-input-adapter.ts`
- pending interactions and approvals: `src/service/interaction-broker.ts`
- runtime hubs, inspect, rollback, and runtime preferences: `src/service/runtime-surface-controller.ts`
- turn lifecycle and final-answer recovery: `src/service/turn-coordinator.ts`
- Telegram runtime rendering: `src/telegram/ui-runtime.ts`
- Telegram final-answer rendering: `src/telegram/ui-final-answer.ts`
- protocol wrapper and bridge adoption of app-server: `src/codex/app-server.ts`
- SQLite public facade: `src/state/store.ts`
- install, update, doctor, and service management: `src/install.ts`

## Top-Level Layout

- `src/cli.ts` is the `ctb` entrypoint. It routes install and admin commands into `src/install.ts` and service startup into `runBridgeService`.
- `src/core/` holds the first internal Core seam:
  - `domain/` for bridge-owned terms and persisted-record contracts
  - `interaction-model/` for semantic runtime, interaction, and terminal view contracts
  - `workflow/` for bridge-owned reduction helpers that do not import Telegram types
- `src/service.ts` is still the bridge shell. It owns bootstrap, readiness and store wiring, authorization gating, Telegram ingress, top-level command and callback routing, app-server lifecycle wiring, and safe Telegram send/edit helpers.
- `src/service/` holds the extracted runtime-domain owners.
- `src/telegram/ui.ts` is only a barrel. Real Telegram UI logic lives in `src/telegram/ui-*.ts`.
- `src/state/store.ts` stays the public SQLite facade while `src/state/store-*.ts` holds the internals.
- `src/install.ts` is still the main operations hotspot.

## Current Service Owners

These are the narrow owners worth reading before broad shell code:

- `command-router.ts` - registry-driven Telegram command dispatch
- `callback-router.ts` - parsed callback dispatch
- `session-project-coordinator.ts` - project picker, manual path flow, session switching, rename, pin, archive and unarchive, `/status`, `/where`, and session plan-mode toggling
- `project-browser-coordinator.ts` - `/browse`, directory navigation, text preview pagination, image preview handoff, and root-path confinement
- `codex-command-coordinator.ts` - model, reasoning effort, skills, plugins, apps, MCP, account, review, fork, rollback, compact, and thread metadata commands
- `rich-input-adapter.ts` - `/skill`, `/local_image`, `/mention`, queued structured inputs, Telegram photo adaptation, and voice-input orchestration
- `interaction-broker.ts` - bridge-owned interaction cards, pending-interaction persistence, resolution, expiry, and failure cleanup
- `runtime-surface-controller.ts` - runtime hubs, status and error cards, inspect rendering, runtime-field selection, rollback picker, and runtime-surface update policy
- `turn-coordinator.ts` - active-turn ownership, turn start and resume, blocked-turn continuation, interrupt, notification consumption, terminal cleanup, final-answer delivery, and history-backed recovery
- `runtime-notice-broadcaster.ts` - deferred runtime notices
- `thread-archive-reconciler.ts` - archive and unarchive reconciliation plus pending-op cleanup
- `subagent-identity-backfiller.ts` - protocol-backed subagent naming recovery
- `runtime-surface-trace-sink.ts` - structured Telegram runtime-surface trace logging

Small support modules still worth knowing about:

- `runtime-surface-state.ts` - shared runtime-card and hub message-state helpers
- `turn-artifacts.ts` - focused helpers for extracting final-answer artifacts from thread history

## Telegram UI Split

Telegram presentation is now split cleanly enough that you usually do not need `src/telegram/ui.ts`.

- `ui-callbacks.ts` - command parsing plus callback encoding and decoding
- `ui-messages.ts` - project picker, session list, model picker, status, where, and other non-runtime replies
- `ui-runtime.ts` - runtime hubs, interaction cards, inspect views, rollback picker, project-browser surfaces, and runtime-field labels
- `ui-final-answer.ts` - Telegram-safe rendering for final answers, previews, pages, and recent output entries
- `ui-shared.ts` - shared formatting helpers such as HTML escaping, relative time, labels, and button chunking

Rule that matters:

- when a semantic contract already exists in `src/core/interaction-model/`, Telegram UI should consume it rather than invent bridge meaning in place

## Store Split

`src/state/store.ts` remains the only public store entrypoint.
That boundary is deliberate.

Current internals:

- `store-open.ts` - open, schema initialization, integrity handling, and failure markers
- `store-records.ts` - row types, mappers, and select helpers
- `store-auth.ts` - authorized user, chat binding, and pending authorization persistence
- `store-sessions.ts` - sessions, recent projects, scan cache, aliases, and active-session normalization
- `store-runtime-artifacts.ts` - runtime notices, runtime-card preferences, UI language, final-answer views, turn-input sources, and readiness snapshots
- `store-pending-interactions.ts` - pending-interaction CRUD and lifecycle transitions

## Real Remaining Hotspots

The dense areas that still matter are:

- `src/service.ts` - highest-level shell and still the largest production file
- `src/service/runtime-surface-controller.ts` - hub orchestration, reanchor policy, inspect rendering, and runtime-preference flow
- `src/install.ts` - release build/copy, wrapper and unit generation, service-manager adapters, status and doctor formatting, update, and uninstall behavior
- `src/service.test.ts` - broad end-to-end regression coverage
- `src/telegram/ui.test.ts` - cross-module UI coverage

These are not automatic refactor targets.
They are only worth splitting further if the active task proves a real boundary.

## Read Order Rules

- If the question is about bridge meaning, start in `src/core/`.
- If the question is about how the shell applies that meaning today, read one narrow file in `src/service/`.
- If the question is about what Telegram shows, read one narrow file in `src/telegram/ui-*.ts`.
- If the question is about persistence behavior, read `src/state/store.ts` and then one narrow `store-*.ts` file.
- If the question is about install or diagnostics, read `src/install.ts` before anything else.

## What This File Is Not

This file is not:

- a product spec
- a future architecture proposal
- proof that the repo is already multi-platform

For the future direction, read `docs/future/multi-platform-core-prd.md`.
