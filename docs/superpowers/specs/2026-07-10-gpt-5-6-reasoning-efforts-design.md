# GPT-5.6 Reasoning Effort Compatibility Design

## Goal

Render, select, persist, and submit the `max` and `ultra` reasoning-effort values returned by Codex 0.144.1 for GPT-5.6 models without displaying `undefined` or dropping callback selections.

## Root Cause

The app-server `model/list` response now includes `max` and `ultra`. The bridge's `ReasoningEffort` union, label formatters, and callback parser only accept values through `xhigh`. Runtime model data therefore reaches a non-exhaustive formatter and produces an undefined Telegram button label; callback parsing would also reject either new value.

## Behavior

- Extend the bridge-owned `ReasoningEffort` type with `max` and `ultra`.
- Render their product labels as `Max` and `Ultra` in both Chinese and English UI surfaces.
- Accept both values in model-effort callback parsing and preserve them through callback routing.
- Persist either value in the existing nullable text session column without a schema migration.
- Pass the selected value unchanged to Codex `turn/start` and collaboration-mode settings.
- Keep the default-effort button behavior unchanged.
- Add a defensive formatter fallback that returns the raw runtime value, so a future server-added effort does not render as `undefined`; unknown callback values remain rejected until explicitly supported.

## Testing

- A model picker containing `max` and `ultra` renders buttons labeled `Max` and `Ultra` and never includes `undefined`.
- Callback data for both values round-trips through encode and parse.
- Selecting each value persists it on the active session and updates the picker response.
- A turn started with a persisted new value sends that exact effort to the app-server.
- Existing effort values and default selection remain unchanged.

## Scope

This change does not hard-code GPT-5.6 model IDs, infer meanings for the Sol/Terra/Luna variants, change model ordering, or expose unknown future effort values as selectable callbacks.
