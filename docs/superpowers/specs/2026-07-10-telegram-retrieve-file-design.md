# Telegram `/retrieve` File Delivery Design

## Goal

Add a Telegram-only `/retrieve <file path>` command that sends a local file, such as an HTML report, into the authorized private Telegram chat for mobile review.

## Scope

- Retrieve one regular file per command.
- Require an active bridge session so relative paths have an unambiguous project root.
- Resolve relative paths against the active session's project root.
- Accept absolute paths and a leading `~/` home-directory shorthand.
- Send files whose real path is inside the active project without confirmation.
- Require an inline confirmation before sending files outside the active project.
- Reject directories, special files, unreadable files, and files larger than 50 MiB.
- Enable the command only when the active pack is Telegram.

The feature does not archive directories, expand globs or environment variables, retrieve multiple files, split large files, or add Feishu support.

## User Interface

The command syntax is:

```text
/retrieve reports/audit.html
/retrieve /tmp/report.html
/retrieve ~/reports/report.pdf
```

Everything after `/retrieve` is treated as one path, so paths containing spaces work without shell quoting. One matching pair of outer single or double quotes is removed for users who paste a shell-style quoted path. The command does not perform shell evaluation.

For a project-contained file, the bridge immediately sends a Telegram document with a bounded caption containing the resolved display path and human-readable file size.

For a project-external file, the bridge sends a warning card containing:

- the resolved real path;
- the file size;
- the active project path;
- Confirm and Cancel buttons.

The confirmation is single-use, expires after two minutes, and is bound to the authorized chat, active session, project root, requested path, and resolved real path.

## Path and Security Rules

The bridge resolves the active project root and target through `realpath`. Containment is determined with path-component-aware relative-path logic, not string-prefix comparison. A symlink located inside the project but resolving outside the project is therefore treated as an external file and requires confirmation.

Validation requires all of the following:

1. The command has a non-empty path.
2. An active, non-archived session exists.
3. The project root resolves successfully.
4. The target resolves successfully and is readable.
5. `stat` reports a regular file.
6. The size is no greater than `50 * 1024 * 1024` bytes.

Before an external-file confirmation is executed, the bridge repeats path resolution, file-type, readability, and size validation. The command is rejected if the active session or project changed, the requested path now resolves to a different real path, or the file no longer satisfies the constraints. The user must issue a new `/retrieve` command after any such change.

Only the opaque confirmation token is stored in callback data. Local paths never appear in callback payloads.

## Architecture

### Retrieve coordinator

A focused `RetrieveFileCoordinator` owns path normalization, file validation, project containment, pending confirmations, revalidation, and delivery orchestration. It depends on narrow interfaces for the active-session store, Telegram document delivery, Telegram text delivery, time, and token generation.

The coordinator does not depend on Codex app-server state and does not reuse the shell-command policy. File disclosure and shell execution remain separate permission domains.

### Command registry and routing

The centralized Telegram command registry gains a `retrieve` entry and `handleRetrieve` handler. Help text and Bot API command synchronization derive from that registry as they do for existing commands.

`BridgeService` routes `/retrieve` to the coordinator only when `activePack === "telegram"`. On Feishu, the command follows the existing unsupported-command path and cannot reach file delivery.

### Callback routing

The Telegram callback codec gains retrieve-confirm and retrieve-cancel variants carrying an opaque token. `BridgeService` delegates those callbacks to the coordinator and answers the callback query with the coordinator's terminal status text.

### Delivery

The coordinator calls the existing `safeSendDocumentResult` path, preserving the bridge's retry and logging behavior. It supplies the original basename as the Telegram filename and a bounded caption. A successful API result is the success condition; a null result produces a clear upload-failure message.

## Data Flow

### Project-contained file

1. Parse the entire command remainder as a path.
2. Load the active session and resolve the project root.
3. Resolve and validate the target.
4. Determine that the target real path is contained by the project real path.
5. Send the document immediately.

### Project-external file

1. Parse, resolve, and validate as above.
2. Determine that the target real path is outside the project real path.
3. Replace any older pending retrieve confirmation for the same chat and session.
4. Store a two-minute pending confirmation and send the inline keyboard.
5. On approval, consume the token, verify its chat binding, re-read the active session, and repeat validation.
6. Require the revalidated real path to equal the confirmed real path, then send the document.
7. On cancellation, expiry, mismatch, or failure, do not upload the file.

## Errors and User Feedback

User-facing responses distinguish:

- missing path or missing active session;
- project or target path not found;
- unreadable target;
- directory or non-regular target;
- file larger than 50 MiB, including its actual readable size;
- external-file confirmation requested, canceled, expired, or invalidated;
- session, project, or resolved path changed before confirmation;
- Telegram document upload failure.

Filesystem and API exception details are logged but are not copied into Telegram messages. Paths shown to the user are bounded so messages and captions remain within Telegram limits.

## Testing Strategy

Unit tests for `RetrieveFileCoordinator` use real temporary files and directories where filesystem behavior matters. They cover:

- relative paths, absolute project-contained paths, paths containing spaces, quoted paths, and `~/` expansion;
- direct delivery for project-contained regular files;
- confirmation for project-external files and symlinks escaping the project;
- single-use confirmation, expiration, cancellation, and replacement by a newer request;
- chat, session, project, and real-path binding;
- revalidation after file deletion, symlink retargeting, or size change;
- missing, unreadable, directory, special-file, and oversized targets;
- successful delivery and upload failure feedback.

Command-registry, callback-codec, and service-routing tests cover:

- `/retrieve` registration, help text, and handler dispatch;
- confirm and cancel callback round trips;
- Telegram ingress reaching the coordinator;
- Feishu ingress remaining unsupported and never invoking file delivery.

The final verification runs type checking, the full test suite, the production build, whitespace checks, local installation, bridge doctor/status, and a Telegram smoke test with one project-contained HTML file and one confirmed external file.
