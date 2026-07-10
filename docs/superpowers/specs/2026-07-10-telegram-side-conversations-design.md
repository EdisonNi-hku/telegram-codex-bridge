# Telegram Side Conversations Design

## Goal

Add a Telegram-only `/side` experience that mirrors Codex's transient side conversations: fork the active Codex thread into an ephemeral question space, keep the parent task running, make the current routing target unmistakable, and return safely without polluting normal session history.

## Verified Codex Semantics

Codex 0.144.1 implements `/side [message]` as an ephemeral fork of the displayed thread. The fork inherits the parent's history as reference context, receives hidden boundary and developer instructions, may run while the parent is active, and is discarded when the user returns to the parent. A side conversation cannot be nested or renamed and is not resumable history.

The installed app-server schema exposes the required primitives:

- `thread/fork` with `ephemeral`, model/config, permission, and service-tier overrides
- `thread/inject_items` for appending the hidden boundary item
- `turn/interrupt` for an active side turn
- `thread/unsubscribe` for closing the ephemeral thread subscription

OpenAI's current TUI source describes side conversations as transient forks for quick questions while keeping the primary thread focused. The exact `/side` term is not yet documented in the public Codex manual, so this design treats the installed 0.144.1 schema and the official OpenAI Codex source as the authoritative compatibility evidence for this environment.

## User Experience

### Entering Side

- `/side <question>` creates the side conversation, makes it the current input target, and submits `<question>` as the first side turn.
- Bare `/side` creates the side conversation and waits for the next ordinary message.
- The active parent must be a visible regular bridge session with a materialized Codex thread. If the parent has not started a Codex conversation, the bridge asks the user to send a normal task first.
- A side conversation may be opened while the parent is idle, running, waiting for input, or waiting for approval.
- The bridge refuses creation when the chat has no free parallel-turn capacity, so it never enters an unusable side mode.
- A chat may have at most one open side conversation. Running `/side` from inside side mode does not nest; it refreshes the side card and explains how to return.

### Persistent Side Mode

After successful creation, ordinary messages route to the side session until the user explicitly returns. The bridge replaces the pinned current-session card with one persistent side card rather than appending controls to every answer.

The card shows:

- `Side` plus the parent session/project identity
- the side state: waiting for input, running, completed, interrupted, or failed
- the parent state: idle, running, waiting for input, waiting for approval, completed, interrupted, failed, or closed
- a read-only parent-status action while the parent has no actionable request
- `返回并处理审批` when the parent needs input or approval
- `返回查看结果` when a parent terminal result is held
- `返回主会话` in the normal case
- `中断 Side` while the side turn is running

Parent status changes edit this one card in place. They do not append chat notifications. Side answers use the existing final-answer delivery UI and remain visually identified with the side session/project context.

### Command Policy in Side

The side command allowlist is:

- ordinary text and supported rich input routed to the side thread
- leading-`!` user-shell commands routed to the side thread
- `/status`
- `/where`
- `/inspect`
- `/retrieve`
- `/interrupt`
- `/side back`

All commands that create, switch, archive, rename, fork, roll back, clear, compact, reconfigure, or otherwise structurally mutate bridge sessions are rejected with a concise instruction to return to the parent first. `/inspect`, `/where`, `/interrupt`, and relative `/retrieve` operate on the current side session. The parent-status button is a dedicated read-only action; it does not change the active input target.

The first release does not add Codex's `/btw` alias.

### Returning

- The inline return action and `/side back` are equivalent.
- If the side is idle, return proceeds immediately.
- If the side has a running turn, the bridge shows a confirmation with `中断并返回` and `继续 Side`.
- Confirmed return interrupts the active side turn, unsubscribes the ephemeral thread, restores the parent as the active session, deletes the transient side record, restores and pins the normal current-session card, surfaces pending parent interactions, and releases held parent terminal output.
- If interrupt or unsubscribe fails, the bridge keeps side mode active, retains the held parent output, and reports that return did not complete. It never presents the parent as active before cleanup succeeds.
- Stale, duplicated, or already-consumed callbacks answer `这个 Side 操作已失效。` and do not change focus.

Returning destroys the side. It cannot be reopened or resumed.

## Parent Activity While Side Is Open

### Progress and Interaction Requests

The parent turn continues through the existing turn coordinator. Parent notifications update the parent-state projection on the side card.

When the parent needs input or approval:

- the bridge persists the interaction normally
- the full interaction card is withheld while side is active
- the side card changes to `主会话：等待输入` or `主会话：等待审批`
- the primary action becomes `返回并处理`
- returning surfaces the pending interaction card after the parent becomes active

The user cannot approve a parent action from side mode.

### Terminal Output

Parent final answers, plan results, and terminal failure/interruption notices must not appear in the middle of side dialogue.

When the parent reaches a terminal state while side is open:

1. Render and persist the terminal result using the existing terminal-result model.
2. Store its delivery state as `held_for_side` without sending a result or deferred notice.
3. Update the side card's parent state.
4. Keep side active until the user returns.
5. On return, atomically claim held records in creation order and run the normal delivery path.

The claim transition guarantees at-most-once release even when parent completion races with return or the return callback is duplicated. A Telegram delivery failure after release uses the existing deferred-delivery mechanism, so the content remains recoverable.

## Architecture

### Side Conversation Coordinator

A focused coordinator owns the side lifecycle and exposes narrow operations:

- start from a regular parent session
- submit the optional inline first prompt after activation
- resolve the current side/parent relationship
- classify commands against the side allowlist
- render or refresh parent status
- begin and consume return confirmation
- close the ephemeral thread and restore the parent
- recover stale side records at service startup

The command router delegates `/side` and side-mode command gating to this coordinator. The normal turn coordinator continues to own side turns; it receives a real `SessionRow`, not a virtual in-memory substitute.

### App-Server Boundary

Extend the app-server client with typed wrappers for:

- ephemeral thread fork with inherited active model, reasoning configuration, permissions, working directory, and service tier
- raw boundary item injection through `thread/inject_items`
- `thread/unsubscribe`

The boundary item and appended developer instructions preserve the Codex rules that inherited history is reference-only, only post-boundary user messages are active instructions, subagents are unavailable, and mutations require an explicit post-boundary request.

Creation is staged:

1. Validate parent, capacity, and feature support.
2. Fork the parent with `ephemeral: true`.
3. Inject the hidden boundary item.
4. Create the transient bridge session and side relationship in one store transaction.
5. Switch the active binding to side and render its card.
6. Submit the optional inline prompt.

If steps 2 or 3 fail, the parent remains active. A partially created ephemeral thread is unsubscribed best-effort and recorded in logs; it is never exposed as a normal bridge session.

### State Model

Extend persisted sessions with:

- `sessionKind: "regular" | "side"`, defaulting to `regular` for all existing rows
- `parentSessionId: string | null`, required only for `side`

A valid side row is non-archived, belongs to the same chat and project as a visible regular parent, and has a non-null ephemeral thread ID. Store APIs enforce these invariants.

Normal session listing, resume, archive, rename, project statistics, and recovery queries exclude `side`. Active-session lookup may return side so existing input and turn routing can be reused. The store adds an explicit hard-delete operation restricted to side rows.

Terminal-result delivery state adds `held_for_side`. Store operations atomically list-and-claim held parent results before delivery.

### Card and Callback Boundary

The current-session card controller selects either the existing regular-session view or a dedicated side view. Side callback payloads use compact opaque tokens bound server-side to:

- chat ID
- side session ID
- parent session ID
- card generation
- action
- creation and expiry timestamps for return confirmations

The callback router acknowledges promptly and delegates exactly one lifecycle decision. The coordinator revalidates the current persisted relationship before every mutation.

### Concurrency

A per-chat side lifecycle queue serializes create, return, callback, startup recovery, and relationship-changing events. Turn notifications remain concurrent but update persisted parent/side state before requesting a card refresh.

Terminal delivery checks the persisted active side relationship rather than a stale in-memory active-session snapshot. This closes the race where a parent completion and side return happen in the same event-loop window.

## Failure and Recovery

### Runtime Failures

- Fork failure: keep parent active and show a compact creation failure.
- Boundary injection failure: unsubscribe best-effort, keep parent active, and do not create a side row.
- Inline first-turn failure: keep the successfully created side open in waiting state and report that the question was not submitted.
- Side-card edit failure: send a replacement card, pin it, and retire the stale card using the existing current-card rules.
- Interrupt failure: keep side active and allow retry.
- Unsubscribe failure: keep side active and allow retry.
- Parent unexpectedly disappears: close side, activate the most recent visible regular session, or return to `/new` when none exists.

### Service Restart

Side threads are intentionally non-resumable. During startup recovery, before normal current-card restoration:

1. Find every persisted side row.
2. Restore its visible parent as active when available; otherwise choose the normal fallback session.
3. Remove the side row and stale side-card binding.
4. Convert held parent terminal results into the normal pending-delivery path.
5. Restore the regular current-session card.
6. Send `Side 已因服务重启关闭。`
7. Deliver claimed parent results. Existing restart recovery marks pre-restart parent interactions failed because their app-server request IDs are no longer actionable; it must not surface stale approval buttons.

Recovery operations are idempotent. A second startup finds no side row and does not repeat the close notice or terminal delivery.

## Compatibility

The `/side` command is Telegram-only in the first release and remains present in Telegram command autocomplete.

Side support uses a feature-local compatibility gate:

- Codex versions older than the first verified 0.144.1 surface are marked unsupported for side without making the entire bridge unready.
- The first side request also treats method-not-found or unsupported-parameter responses from fork, injection, or unsubscribe as feature-local incompatibility.
- Unsupported environments receive a concise instruction to update Codex; all other bridge commands remain available.

Feishu does not advertise or route `/side` in this release.

## Testing Strategy

### Protocol Contract

- Fork sends `ephemeral: true` and preserves the effective parent configuration.
- Boundary and developer instructions are both installed.
- An active side turn is interrupted before unsubscribe.
- Idle side return unsubscribes without a fake turn interruption.
- Protocol incompatibility is reported as a side-only upgrade requirement.

### Store and Migration

- Existing session rows migrate to `regular` with no behavior change.
- Side creation enforces same-chat parent and non-null thread constraints.
- Side rows never appear in normal list, resume, archive, rename, or project-stat surfaces.
- Hard delete accepts only side rows.
- Held terminal results are claimed once and in order.
- Startup recovery is idempotent.

### Lifecycle and Routing

- Bare and inline `/side` flows enter side correctly.
- Parent idle, running, waiting-input, and waiting-approval states all allow side creation.
- Missing or unmaterialized parents, full capacity, and nested side creation are rejected safely.
- Ordinary text, rich input, leading-`!`, and every allowlisted command target side.
- Every non-allowlisted command is blocked before it can mutate parent or global session state.
- Idle return closes immediately; running return requires confirmation.
- Cancelled, stale, and duplicate callbacks have no side effects.

### Parent/Side Concurrency

- Parent and side turns can run concurrently without sharing tracker or terminal state.
- Parent interaction requests update the side card without showing the interaction card.
- Parent completion while side is active holds output and edits the side card only.
- Returning releases the parent result exactly once.
- Completion racing with return produces either direct normal delivery or held-then-released delivery, never both and never neither.
- Side completion delivers normally and does not switch focus.

### Recovery and UI

- Restart closes side, restores parent, sends one notice, releases held output once, and leaves pre-restart interactions in the existing failed-recovery state.
- Every side/parent state renders defined localized text.
- Side buttons stay within Telegram callback limits.
- Card updates edit in place and replacement cleanup follows existing pin/unpin rules.
- Interrupt and unsubscribe failures keep side visible.

### Verification

Run focused tests throughout TDD, followed by the complete test suite, type checking, build, dependency audit, and Telegram smoke tests for concurrent parent execution, parent approval, held final-answer delivery, running-side return confirmation, and restart recovery.

## Out of Scope

- nested side conversations
- restoring or reopening a closed side
- exposing side in `/sessions`, `/resume`, or project history
- the `/btw` alias
- Feishu side UX
- approving parent interactions without returning
- changing Codex's side safety instructions or turning side into a general-purpose persistent fork

## Success Criteria

The feature is complete when a Telegram user can start a side question during a running main task, continue a multi-turn side discussion with an unambiguous persistent card, observe parent state without mixed transcripts, return safely with confirmation when required, receive the held parent result exactly once after return, and recover to the parent cleanly after a bridge restart while normal sessions remain unaffected.
