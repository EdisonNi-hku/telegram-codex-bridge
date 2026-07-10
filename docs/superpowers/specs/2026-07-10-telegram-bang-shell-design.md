# Telegram Bang Shell Design

## Goal

Add Codex-compatible user shell commands to the Telegram bridge. A private,
authorized message whose first character is `!` runs through Codex's native
thread shell-command path instead of becoming a model prompt.

## Confirmed Semantics

- Only an exact leading `!` activates shell mode. Leading whitespace or a `!`
  later in the message remains ordinary prompt text.
- Strip exactly one leading `!`; the remaining text is the shell script.
- An empty script returns concise usage guidance and does not start a command.
- The command uses the active Codex thread's fixed working directory.
- `cd` affects only that shell invocation. It never changes the thread or
  project root, matching native Codex behavior.
- The native shell-command result is retained in the Codex thread context so
  later model turns can see the command and output.
- If the bridge session has no Codex thread yet, create the thread with the
  existing session configuration before submitting the shell command.
- If there is no active bridge session, reject the command with guidance to
  select or create a project first.

## Safety Model

The bound Telegram account remains the outer authorization boundary. The
bridge adds a conservative command-risk gate before invoking Codex's native
full-access user shell.

Commands confidently recognized as low risk run immediately. The initial
direct-run set is deliberately small:

- inspection: `ls`, `pwd`, `cat`, `head`, `tail`, `stat`, `file`, `du`, `df`,
  `rg`, `grep`, `find`, `which`, `type`, `git status`, `git log`, `git diff`,
  `git show`, and `git branch` without mutation flags;
- requested basic creation: `mkdir` without shell redirection or substitution.

Everything else requires confirmation. In particular, deletion, permission or
ownership changes, privilege escalation, process/service control, package
installation, network download/upload, Git history/worktree mutation,
redirection, command substitution, background execution, and any syntax the
classifier cannot confidently parse are confirmation-required.

Confirmation displays the exact script and working directory. The action is
bound to the authorized chat, user, bridge session, and Codex thread, expires
after two minutes, and is single-use. Restarting the bridge safely discards
unconfirmed commands. Cancel and expiry never execute the script.

This gate reduces accidental execution; it is not a sandbox. Confirming an
arbitrary shell script grants that script the same host access as native Codex
shell mode.

## Architecture

1. A small ingress parser identifies exact-leading-bang messages before normal
   prompt and slash-command routing.
2. A pure risk classifier returns `direct` or `confirm`, plus a human-readable
   reason. Uncertainty always returns `confirm`.
3. A shell-command coordinator resolves the active session/thread, creates a
   missing thread through the existing session path, and submits the script to
   the app-server's native `thread/shellCommand` method.
4. Existing command lifecycle notifications drive the Telegram progress and
   completion surface. Output is bounded using the bridge's existing Telegram
   message-size conventions; full native history remains in the Codex thread.
5. A short-lived confirmation store and callback route execute or cancel
   confirmation-required commands.

The native app-server method is preferred over spawning a separate bridge-owned
shell because it preserves Codex cwd, environment, cancellation, history, and
command lifecycle semantics.

## Alternatives Considered

### Spawn a shell directly from the bridge

Simple initially, but it duplicates Codex environment and lifecycle behavior,
does not naturally write results into thread context, and can drift from Codex.
Rejected.

### Convert `!` into a model prompt

Reuses existing turn execution and approval handling, but is not direct or
deterministic and spends model tokens. Rejected.

### Use native `thread/shellCommand` with a bridge risk gate

Best semantic match and least duplicated execution machinery. Selected.

## Error Handling

- No active session: explain how to select or create one.
- Missing thread: create it; report a normal bridge error if creation fails.
- App-server unavailable: use existing guarded-error reporting; do not fall
  back to an independent shell.
- Command failure: show stderr/output and exit code as a completed shell result,
  not as a bridge crash.
- Oversized output: send a bounded preview and preserve the full result only in
  Codex's native thread history.
- Duplicate, stale, mismatched, or expired callbacks: reject without execution.

## Unit-Test-Driven Implementation

Implementation proceeds in red-green-refactor slices:

1. Exact-leading-bang parser tests, including whitespace, embedded `!`, empty
   input, and stripping exactly one prefix.
2. Risk-classifier table tests for direct commands, dangerous commands,
   metacharacters, quoting, and fail-closed unknown syntax.
3. App-server client test for the exact `thread/shellCommand` request.
4. Coordinator tests for no session, missing-thread creation, direct execution,
   confirmation, expiry, cancellation, single use, and identity/thread binding.
5. Message-routing tests proving bang handling precedes normal prompt routing
   but does not capture non-leading exclamation marks.
6. Notification/rendering tests for success, non-zero exit, interruption, and
   output truncation.
7. Full type-check, unit suite, build, dependency audit, local install, and
   Telegram smoke tests.

## Acceptance Criteria

- `!ls` executes immediately in the active thread cwd.
- `!mkdir new_project` executes immediately in the active thread cwd.
- `!cd subdir && pwd` reports the subdirectory, while the next `!pwd` reports
  the unchanged thread cwd.
- ` !ls` and `please !ls` remain ordinary model prompts.
- A dangerous or unrecognized command cannot execute before a valid, current
  confirmation callback.
- Command/output history is visible to a later Codex model turn.
- Existing slash commands, plain prompts, rich inputs, and interaction answers
  keep their current behavior.
