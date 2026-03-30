<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: narrow predesign note for the next layer after binding neutralization, defining a platform surface adapter boundary and the minimum capability vocabulary it needs
read_when:
  - moving beyond MP-01 naming and persistence neutralization
  - deciding how capability work should start without prematurely extracting a Telegram pack
skip_when:
  - the task is only about current Telegram UX behavior or only about persistence naming
source_of_truth:
  - docs/future/multi-platform-core-prd.md
  - docs/plans/2026-03-30-platform-binding-boundary-design.md
  - src/core/interaction-model/runtime.ts
  - src/core/workflow/runtime-workflow.ts
-->

# Platform Surface Adapter And Capability Prep

Status: Active predesign note
Date: 2026-03-30

## Why This Exists

`MP-01` has moved the repo a long way on neutral binding and persistence language.

That work reduces one class of Telegram-first coupling:

- who the remote principal is
- which chat target owns a session foreground
- how bridge-owned state is persisted

It does not yet solve the next class of coupling:

- which platform surface action should happen
- whether the platform can edit, paginate, upload, or keep callback-driven state alive
- where fallback policy should live when the ideal Telegram-style UX is not available

If the repo jumps straight from binding neutralization into a full capability layer, it will likely repeat the same mistake as before:

- broad abstraction names
- unclear ownership between workflow, presentation, and pack code
- Telegram behavior still acting as the hidden default

So the next step should stay narrow.

## Current Truth

Today the repo already has:

- shared Core interaction-model view shapes
- shared Core runtime workflow reduction
- neutral binding language for principal, chat target, and chat binding

Today the repo does not yet have:

- a platform surface adapter boundary
- an explicit capability vocabulary that workflow can target
- a clean place to decide delivery fallback outside Telegram-first code paths

That means current runtime, interaction, and terminal delivery still depend on a blended stack:

- Core view creation
- service-level orchestration
- Telegram-aware send/edit/callback assumptions

This is acceptable for the shipped Telegram-first product.
It is the next pressure point for multi-platform work.

## Selected Next Slice

The next slice should define two things only:

### 1. Platform surface adapter boundary

This boundary answers:

- which surface target is being addressed
- which delivery operation is being requested
- which persisted delivery refs are relevant for retries or re-render
- which fallback result the caller should expect

It should sit between:

- Core workflow output
- platform-specific rendering and transport execution

It should not own:

- auth or session binding persistence
- Telegram callback encoding
- final HTML formatting details
- pack loading or install flow

### 2. Minimum capability vocabulary

This vocabulary should be intentionally small.

The first version only needs to answer whether a surface can support:

- callback actions
- message edits
- rich text preview rendering
- long-form paginated follow-up
- media or file upload delivery

That is enough to start moving fallback policy out of Telegram-first service code.

It is not enough to describe every future platform nuance, and that is fine.

## Proposed Ownership

### Core workflow owns

- the semantic intent:
  - runtime status surface
  - pending interaction surface
  - final-answer surface
  - deferred terminal notice
- the semantic fallback preference:
  - preferred surface action
  - acceptable degraded action

### Platform surface adapter owns

- turning semantic delivery intent into capability-aware surface operations
- deciding whether the current platform target can:
  - edit
  - callback
  - paginate
  - upload
  - render the preferred preview mode
- returning a stable result that service code can persist or retry against

### Presentation owns

- rendering the chosen surface payload for the concrete platform
- no workflow policy

### Pack owns

- transport glue
- ingress and egress details
- auth and install specifics
- no shared delivery semantics

## First Contract To Add

The first new contract should be small enough that Telegram can implement it without moving files around just for aesthetics.

Suggested shape:

### A. Capability snapshot

- a read-only object for the current platform target
- likely per-platform for now, not per-message

Suggested first fields:

- `supportsCallbacks`
- `supportsEdits`
- `supportsRichTextPreview`
- `supportsLongFormPagination`
- `supportsUploads`

### B. Surface intent

- a small semantic enum or tagged union describing what workflow wants to do

Suggested first intents:

- `runtime_status`
- `pending_interaction`
- `terminal_result`
- `terminal_result_deferred_notice`

### C. Surface operation result

- a stable result returned to service code

Suggested first outcomes:

- `sent`
- `edited`
- `deferred`
- `failed`
- persisted delivery refs when available

This is enough to start moving fallback policy into one place without pretending the whole architecture has flipped.

## Immediate Coding Rule After This Design

When the next implementation step starts:

- service code should ask the adapter what delivery path is possible
- workflow should express semantic surface intent, not Telegram-specific operations
- Telegram rendering should receive a selected operation, not infer workflow policy from scratch

Do not start by:

- extracting a Telegram pack directory
- adding a giant capability matrix
- renaming all UI modules
- introducing second-platform placeholders everywhere

## Current Implementation Status

As of 2026-03-30:

- a shared Core surface contract now exists for:
  - `PlatformCapabilitySnapshot`
  - semantic surface intent
  - stable surface operation result
- Telegram now has a thin surface-adapter helper that applies that contract to HTML send or edit delivery
- the contract is already used by:
  - pending interaction card delivery
  - terminal result direct delivery
  - terminal-result deferred-notice fallback

This is still intentionally narrow.
It is not yet the full capability layer.

## Non-Goals

This design does not yet:

- implement the capability layer
- define a second platform
- change current Telegram UX behavior
- move Telegram rendering files into a new pack structure
- solve every transport or formatting concern

## Exit Criteria

This predesign is good enough when:

- the next implementation slice can name one adapter contract and one capability snapshot without hand-waving
- workflow, presentation, and pack responsibilities are separated clearly enough to avoid another rename-only refactor
- Telegram can become the first adapter implementation without forcing repo-wide movement first
- future capability work has a narrow place to land
