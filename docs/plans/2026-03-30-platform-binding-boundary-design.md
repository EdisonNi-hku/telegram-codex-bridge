<!-- docmeta
role: leaf
layer: 3
parent: docs/plans/README.md
children: []
summary: design note for stabilizing the platform binding boundary after auth and persistence neutralization work landed
read_when:
  - deciding what should own platform, user, chat, and binding identity next
  - continuing MP-01 without jumping early to capability or Telegram pack work
skip_when:
  - the task is only about current Telegram UX behavior
source_of_truth:
  - docs/future/multi-platform-core-prd.md
  - docs/plans/2026-03-30-binding-model-neutralization-note.md
  - src/core/domain/binding.ts
  - src/state/store-auth.ts
  - src/state/store-sessions.ts
-->

# Platform Binding Boundary Design

Status: Active implementation note
Date: 2026-03-30

## Why This Exists

`MP-01` has already neutralized runtime and pending persistence, then moved auth and session binding rows to neutral columns and neutral aliases.

That is useful, but it is still an implementation transition.

Without a stable boundary, the repo can easily drift back into:

- Telegram field names showing up as the default business language
- session ownership and transport identity getting mixed together
- future capability or pack work building on a vague binding model

## Current Truth

Today the shipped product is still:

- one Telegram bot
- one authorized Telegram user
- one Telegram chat as the active control surface

What changed is internal structure:

- binding rows now persist neutral `platform`, `user_id`, `chat_id`, and `username` fields
- code can now speak in `platform`, `userId`, and `chatId` terms first
- Telegram columns remain compatibility mirrors

This is still not multi-platform support.

## Selected Boundary

The stable boundary should distinguish four different things:

### 1. Platform principal

Who is the remote identity?

Fields:

- `platform`
- `userId`
- `username`

Examples:

- Telegram user id
- future Slack member id

### 2. Platform surface target

Where does the bridge send or receive interaction?

Fields:

- `platform`
- `chatId`

Examples:

- Telegram private chat
- future Slack DM or channel

### 3. Platform binding

Which principal currently controls which surface target?

Fields:

- `platform`
- `userId`
- `chatId`
- `activeSessionId`

This is the narrow auth-and-routing join.

### 4. Bridge session ownership

Which surface target currently owns a bridge session foreground?

Fields:

- `chatId`

For current shipped behavior, `session` still belongs to one Telegram chat target.
That is acceptable for now because the product is still Telegram-first.

## What This Boundary Owns

This boundary owns:

- authorization identity
- pending authorization candidates
- current control-surface binding
- bridge session foreground ownership by platform target

This boundary must not own:

- Telegram callback payload formats
- Telegram message ids
- final-answer rendering decisions
- capability policy
- install or pack selection

## Immediate Coding Rule

When code outside the Telegram adapter layer needs identity or routing context, it should prefer:

- `platform`
- `userId`
- `chatId`

It should not invent new business logic directly around:

- `telegram_user_id`
- `telegram_chat_id`
- `telegram_username`

Those names are now compatibility details, not primary model language.

## Current Implementation Status

As of 2026-03-30:

- `PlatformUserRef`, `PlatformChatRef`, and `PlatformBindingRef` now have one shared Core home
- binding resolution from neutral fields vs Telegram compatibility mirrors now goes through shared helper functions
- auth/session persistence paths and critical session-to-chat identity checks already use that shared helper layer
- install/admin pending-authorization flows now prefer neutral binding terms in their primary logic
- store-facing session, pending-interaction, runtime-notice, current-session-card, and final-answer persistence entry points now prefer neutral binding and delivery field names in their public inputs
- test helpers now mostly construct auth, session, and persistence fixtures through neutral field names first, keeping Telegram mirrors as compatibility detail instead of default language

## Non-Goals

This design does not yet:

- support multiple platforms at runtime
- define pack loading
- define platform capability policy
- make `session` globally platform-agnostic beyond its current `chatId` ownership edge

## Exit Criteria

This boundary is stable when:

- auth and session code uses platform-binding language by default
- Telegram-specific columns exist only for migration or compatibility reasons
- future pack work can treat binding as a separate concern from presentation and transport
- future capability work no longer has to guess whether identity belongs to Core, Presentation, or Pack
