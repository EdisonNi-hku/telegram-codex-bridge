<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: narrow design note for neutralizing the Telegram-first auth and session binding model without claiming multi-platform support
read_when:
  - continuing MP-01 after runtime and pending persistence neutralization
  - deciding how auth, chat binding, and session ownership should evolve next
skip_when:
  - the task is only about current shipped behavior with no schema or model changes
source_of_truth:
  - docs/future/multi-platform-core-prd.md
  - docs/plans/2026-03-23-multi-platform-core-pending-task-tracker.md
  - src/state/store-auth.ts
  - src/state/store-sessions.ts
-->

# Binding Model Neutralization Note

Status: Active implementation note
Date: 2026-03-30

## Problem

`runtime_notice`, `final_answer_view`, `current_session_card`, and `pending_interaction` now have neutral chat or message fields.

The remaining Telegram-first pressure point is the binding layer:

- `authorized_user`
- `pending_authorization`
- `chat_binding`
- `session`

Those records still persist Telegram-specific field names as the primary storage shape even though higher-level code now wants to speak in neutral `userId`, `chatId`, and `username` terms.

## Goal

Make the binding layer structurally consistent with the rest of `MP-01` without pretending the product is already multi-platform.

That means:

- keep shipped behavior Telegram-first
- add neutral columns and neutral row shapes
- preserve legacy Telegram columns as compatibility mirrors for now
- avoid pack or capability work in this slice

## Selected Model

For the current bridge, binding rows stay single-platform but become explicit about it.

### Authorized user

- `platform`
- `user_id`
- `username`
- legacy mirrors:
  - `telegram_user_id`
  - `telegram_username`

### Pending authorization

- `platform`
- `user_id`
- `chat_id`
- `username`
- legacy mirrors:
  - `telegram_user_id`
  - `telegram_chat_id`
  - `telegram_username`

### Chat binding

- `platform`
- `chat_id`
- `user_id`
- `active_session_id`
- legacy mirrors:
  - `telegram_chat_id`
  - `telegram_user_id`

### Session ownership

- `chat_id`
- legacy mirror:
  - `telegram_chat_id`

`session` still belongs to one current Telegram chat in shipped behavior.
This step only removes Telegram-first naming as the primary schema language.

## Non-Goals

This step does not:

- add a second platform
- formalize a Telegram pack
- introduce capability policy
- redesign install or admin flow
- change the single-user Telegram trust model

## Exit Criteria

This slice is done when:

- new databases create neutral binding columns by default
- old databases migrate and backfill those columns safely
- store auth and session APIs can use neutral field names as the primary interface
- current Telegram behavior and recovery flows still pass existing tests

## Current Implementation Progress

As of 2026-03-30:

- binding schema neutralization is landed through the current SQLite migration path
- auth and session store APIs already accept neutral `userId`, `chatId`, and `username` terms as the primary interface
- a shared binding helper now resolves neutral fields against Telegram compatibility mirrors and centralizes chat-target comparison for business logic
- store-facing runtime artifact and pending-interaction persistence APIs now also use neutral `chatId`, `messageId`, and `deliveryMessageId` terms as the primary interface
- default test setup now mostly seeds authorization, sessions, and persisted artifacts through neutral field names, while explicit Telegram mirror checks remain where compatibility still matters
- Telegram-specific mirror columns still remain in storage and row shapes for compatibility
