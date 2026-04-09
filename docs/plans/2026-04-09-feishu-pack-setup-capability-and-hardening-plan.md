<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: capability definition and hardening backlog for making Feishu pack setup, validation, binding, and callback readiness work as one operator-safe flow
read_when:
  - the task is to harden Feishu installation, readiness, authorization, or first-run operator experience
  - the task needs one place that explains what the Feishu setup capability must guarantee end to end
skip_when:
  - the task is only about current Telegram shipped behavior
  - the task only needs the broader multi-platform Core rollout sequence
source_of_truth:
  - src/install.ts
  - src/readiness.ts
  - src/packs/feishu
  - src/feishu
  - src/service.ts
  - skills/feishu-codex-linker
-->

# Feishu Pack Setup Capability And Hardening Plan

Status: Active hardening plan
Date: 2026-04-09
Owner: Operations / Runtime / Feishu pack

## Purpose

This document turns the recent Feishu setup failures into one explicit product capability.

The goal is not "install a bridge" in the abstract.
The goal is to make `Feishu pack setup` behave like one reliable operator workflow that installs, validates, binds, and proves both message ingress and card callback ingress without leaking platform trivia or internal runtime failures to the user.

## Capability Definition

### Capability Name

`Feishu pack self-install, self-validate, and first-run authorization`

### Capability Outcome

A user with one valid Feishu self-built app should be able to:

1. provide `App ID` and `App Secret`
2. let the bridge install or repair itself
3. receive one clear checklist of required Feishu-side settings
4. verify that text messages and card callbacks are both live
5. bind the first authorized Feishu user
6. create and switch sessions without seeing internal transport, packaging, SQLite, or raw Feishu error-code failures

### Minimum Acceptance Contract

The capability is complete only when all of the following are true:

- install artifacts include everything required for the active `feishu` pack to boot
- readiness verifies pack-local prerequisites, not just shared bridge prerequisites
- the operator can detect whether another client is consuming the same Feishu app traffic
- the first private message creates a pending authorization candidate
- the admin can confirm the pending authorization without stopping the service manually
- a project picker card can be rendered and its buttons can be clicked successfully
- `/status` and `/new` both succeed from Feishu after binding

### Out Of Scope

This capability does not include:

- broad Feishu org-management flows
- group-chat-first workflows
- generic arbitrary Feishu action passthrough
- replacing the current Telegram-first operator model with a Feishu-first product shape

## Operator-Facing Contract

The operator should experience Feishu setup as four explicit phases:

1. `Install`: provide credentials and choose scan roots
2. `Validate`: receive one consolidated checklist for Feishu-side prerequisites
3. `Bind`: send one private message and approve the pending candidate
4. `Smoke test`: prove both plain-text commands and card-button callbacks

The operator should not need to infer any of the following from logs:

- whether the wrong release artifact was installed
- whether the pack is missing runtime dependencies
- whether another Feishu client is stealing events
- whether card callbacks are disabled while text ingress still works
- whether a local admin command failed due to SQLite lock contention

## Failure Classes Exposed By This Session

### 1. Install Source Drift

The GitHub install path resolved to an artifact set that did not match the local repository's Feishu-capable implementation.

Required product response:

- make the selected pack and shipped release truth consistent
- fail early if the fetched install source cannot satisfy the requested pack

### 2. Incomplete Release Packaging

The release install copied `dist` and metadata but did not guarantee pack runtime dependencies in the install root.

Required product response:

- release preparation must produce a bootable install root for the active pack
- readiness should fail before service start if required pack dependencies are absent

### 3. Service-CLI SQLite Lock Contention

`ctb authorize pending --latest` competed with the running bridge over the same SQLite store.

Required product response:

- authorization confirmation must be safe while the service is running
- local admin flows must not require the operator to stop the service to mutate bridge state

### 4. Partial Readiness Truth

Shared readiness passed while Feishu-specific ingress remained only partially configured.
Text ingress worked before card callbacks worked.

Required product response:

- readiness must differentiate text-ingress-ready from callback-ready
- setup completion must require both paths to pass

### 5. Shared-App Event Contention

Another Feishu client consumed events for the same app because long-connection delivery is not broadcast.

Required product response:

- detect and surface likely app-sharing conflicts
- explain that multiple clients on one app are mutually interfering, not independently receiving the same traffic

### 6. Raw Platform Error Leakage

The user saw `200340` instead of a bridge-owned explanation that card callbacks were not configured or not published.

Required product response:

- map known Feishu setup and callback failures to operator-actionable guidance
- reserve raw codes for logs, not primary user-visible messaging

### 7. Missing One-Shot Feishu Checklist

The setup flow had the user discover required Feishu settings incrementally by failing into them.

Required product response:

- publish one minimal required configuration set up front
- verify that exact set before calling setup complete

## Hardening Backlog

## Scope

- In:
  - install packaging
  - readiness and doctor coverage
  - first-run authorization flow
  - callback readiness
  - operator guidance and error translation
- Out:
  - large Feishu UX redesign
  - non-Feishu pack rollout work
  - broad multi-platform architecture refactoring unrelated to setup hardening

## Action Items

[ ] Make release preparation install pack runtime dependencies into the install root and fail the install if the resulting pack cannot boot.
[ ] Unify requested-pack selection across local install, GitHub install, update, and repair paths so `feishu` cannot silently resolve to Telegram-era artifacts.
[ ] Add a Feishu setup readiness slice that explicitly checks `robot ability enabled`, `im.message.receive_v1 configured`, `card.action.trigger configured`, `private-message permission granted`, and `version published`.
[ ] Split Feishu readiness into at least two visible stages: `text ingress ready` and `card callback ready`, and require both before reporting setup complete.
[ ] Rework authorization confirmation so `ctb authorize ...` can succeed while the bridge service is running instead of colliding on the SQLite state store.
[ ] Add a bridge-owned detection path for likely shared-app contention so operators are warned when another long-connection client is consuming the same Feishu app traffic.
[ ] Translate known Feishu setup and callback failures, including `200340`, into explicit operator actions instead of exposing only raw platform codes.
[ ] Upgrade the Feishu linker skill so first-run setup always presents one consolidated prerequisite checklist before the operator starts testing messages and cards.
[ ] Add one end-to-end smoke test contract for Feishu setup that verifies: private text ingress, pending authorization creation, authorization confirmation, `/status`, `/new`, and successful project-card click handling.
[ ] Add regression tests around release packaging, Feishu callback readiness, and service-safe authorization mutation so these failures cannot regress silently.

## Open Questions

- Should Feishu callback readiness remain a strict setup gate, or can the bridge temporarily operate in a degraded `text-only` state with an explicit warning?
- Should shared-app contention detection be passive and heuristic, or should the bridge actively claim exclusivity for a configured Feishu app?
- Should Feishu setup completion require a real project-card click test every time, or only on first install and doctor-repair flows?

## Implementation Ordering

### Phase 1: Stop Silent Misinstalls

Land packaging and install-source consistency first.
If the wrong artifact can still boot partially, every later setup check remains noisy and misleading.

### Phase 2: Make Readiness Honest

Teach readiness and doctor the real Feishu prerequisite graph.
This is where text ingress and callback ingress must stop being treated as one undifferentiated "ready" state.

### Phase 3: Remove Operator-Side Recovery Work

Fix authorization mutation under a running service and add shared-app conflict detection.
At this point the operator should not need service restarts or manual process hunting to complete setup.

### Phase 4: Tighten UX And Verification

Translate raw platform failures, upgrade the skill, and require the full smoke-test path before setup reports success.

## Done Criteria

This hardening plan is complete when an operator can set up Feishu from scratch and the bridge:

- installs the correct pack with all runtime dependencies
- reports exactly which Feishu settings are missing before the operator starts guessing
- binds the first user without local SQLite lock failures
- detects or clearly explains app-sharing conflicts
- turns button-click failures into precise callback guidance instead of raw numeric codes
- proves both text and card callback paths before declaring Feishu setup finished
