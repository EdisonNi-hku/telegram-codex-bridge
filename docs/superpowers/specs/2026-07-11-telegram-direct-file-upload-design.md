# Telegram Direct File Upload Design

## Goal

Add a Telegram-only `/upload` workflow that saves the next Telegram Document directly into the active project's root directory. The file is bridge-managed data: its bytes, caption, and download URL must never be submitted to Codex, added to a prompt, or sent to the app-server.

The primary use case is transferring sensitive configuration such as API-key files from a phone to the local project without asking Codex to read or recreate them.

## User Experience

1. The authorized user sends `/upload` in a Telegram chat with an active project session.
2. The bridge replies that it is waiting for one Document, names the target project, and explains `/cancel` and the five-minute timeout.
3. The next Telegram Document is intercepted before rich-input or Codex routing.
4. The bridge saves it to the project root using its Telegram filename.
5. The bridge exits upload mode after that one Document, whether the transfer succeeds or fails.
6. Success reports only the filename, project-relative destination, and byte count.

`/upload` is permitted while a Telegram Side conversation is active. It still targets the Side session's project root and remains completely outside both the Side and parent Codex threads.

Telegram photos, voice messages, and other media do not satisfy the pending upload. They retain their existing behavior and do not consume the upload state.

## Command and State Model

Introduce a dedicated `UploadFileCoordinator`. It owns short-lived, in-memory pending records keyed by chat:

- chat ID
- active session ID
- project ID or stable project identity
- canonical project-root path captured at command time
- creation and expiration timestamps

The pending state lasts five minutes and accepts exactly one Document. `/cancel` clears it. Service restart also clears it; pending uploads are intentionally not resumable.

`/upload` is rejected when:

- there is no active project session;
- the active session is archived or otherwise not writable;
- rename, manual-path entry, or another bridge-owned text/composer flow is active;
- a pending upload already exists for the chat.

While upload mode is waiting, ordinary text is not sent to Codex. The bridge reminds the user to send a Document or `/cancel`. A repeated `/upload` reports that the bridge is already waiting and leaves the existing state unchanged. `/cancel` clears it. Any other slash command first clears the pending upload and then follows its normal command route, preventing a stale upload from unexpectedly consuming a later file.

## Security Boundary

The upload path is separate from `RichInputAdapter`, media-to-Codex descriptors, turn submission, and all app-server APIs.

The bridge must not:

- decode, inspect, summarize, or preview file contents;
- include file bytes, caption text, Telegram download URL, or local absolute path in a Codex input;
- log file contents, credentials, download URLs, bot-token-bearing URLs, or captions;
- automatically attach the saved file to a later prompt;
- overwrite an existing filesystem entry.

Operational logs may contain the chat/session identifier, a safely escaped filename, declared and actual byte sizes, duration, and outcome. User-facing success output uses a project-relative path only.

## Filename and Filesystem Safety

The destination is always exactly one direct child of the canonical project root. The bridge uses the Telegram `file_name` only after strict validation.

Reject filenames that are empty or normalize to an unsafe value, including:

- `.` or `..`;
- `/` or `\` path separators;
- NUL, CR, or LF;
- absolute paths, drive-qualified paths, or path traversal;
- names that cannot be represented safely by the host filesystem.

Before download, re-read the active session and project and verify they still match the captured session and canonical root. Resolve the root without following a user-controlled destination entry outside it.

Create a randomly named temporary file inside the project root with exclusive-create permissions. Stream the Telegram download into it. After download completion:

1. verify the active session/project binding again;
2. verify the destination is still absent using no-follow filesystem checks;
3. atomically publish the temporary file without replacing an existing file, directory, or symlink;
4. delete the temporary file on every failure path.

Because a plain rename may replace an existing file on some platforms, publication must use a no-clobber primitive or an equivalent exclusive destination reservation. A race that creates the destination causes a safe failure, never replacement.

File permissions should be owner-readable and owner-writable only where the platform supports POSIX modes. This is appropriate for secrets while leaving permission management explicit on other platforms.

## Telegram and Routing Integration

Register `/upload` in the Telegram command registry and command sync. It is unsupported and unsynced for Feishu in this version.

Routing order for an authorized Telegram update is:

1. authorization and runtime-notice handling;
2. `/upload` and `/cancel` command handling;
3. pending-upload Document interception;
4. existing pending interaction/composer and rich-input/media routing;
5. ordinary Codex routing.

When Side mode is active, `/upload` is added to the Side command allowlist. The upload coordinator derives the project from the active Side session but never calls the Side coordinator's turn submission methods.

Only Telegram `document` payloads are accepted. Photos, voices, stickers, videos, and media groups are outside this feature.

## Download and Size Handling

Use the existing Telegram file metadata and streaming download capabilities. Enforce Telegram/API availability and any existing bridge download limits before writing. If declared size is available, reject an unsupported size before download. Track the actual bytes written and report that size on success.

The implementation must avoid loading the complete file into memory. Download directly to the temporary file with bounded streaming behavior.

## Errors and Recovery

All failures produce compact, non-sensitive Telegram messages:

- invalid or missing filename;
- destination already exists;
- project/session changed;
- upload expired or canceled;
- Telegram download failed;
- unsupported size;
- filesystem permission, capacity, or publication failure.

Once a Document claims a pending upload, that pending state is consumed even when the transfer fails. This prevents replay or accidental reuse. The user can issue `/upload` again to retry.

Per-chat serialization ensures two concurrent Documents cannot both claim the same pending record. Different chats remain independent. Temporary-file cleanup is best effort during the immediate failure path. On startup, the bridge also removes abandoned regular files matching its high-entropy `.ctb-upload-<uuid>.tmp` namespace from known project roots before accepting new uploads; it never follows or removes matching symlinks, directories, or unrelated names.

## Testing Strategy

Use unit-test-driven implementation with a real temporary filesystem where filesystem semantics matter.

Required tests include:

- `/upload` registration, Telegram sync, Feishu exclusion, and Side allowlist;
- missing project, archived session, conflicting composer, duplicate pending state, cancel, and timeout;
- ordinary text suppression while waiting;
- photos and voice retaining existing behavior without consuming upload state;
- Document interception before rich-input and Codex submission;
- byte-exact streaming save without content inspection;
- no app-server call, turn submission, auto-attach, content preview, or sensitive log text;
- valid dotfile names such as `.env`;
- path traversal, separators, control characters, absolute/drive paths, and invalid names;
- existing file, directory, and symlink rejection;
- destination creation race and no-clobber publication;
- owner-only POSIX permissions;
- download failure and temporary-file cleanup;
- project/session/root changes before and during download;
- concurrent Documents: exactly one claim and one final destination;
- different-chat independence;
- one-shot success/failure semantics and restart non-resumability;
- Side mode saves to the project without entering either Codex thread;
- existing Telegram media and rich-input behavior remains unchanged.

## Scope

In scope:

- Telegram `/upload` plus `/cancel` integration;
- one Document per invocation;
- direct save to the active project root;
- strict no-overwrite and no-Codex boundary;
- Side-mode support;
- localized help, responses, tests, and current-truth documentation.

Out of scope:

- arbitrary subdirectories or user-supplied destination paths;
- overwriting or rename confirmation;
- multi-file batches;
- photos, voice, video, archives extraction, or content scanning;
- persisted/resumable upload sessions;
- Feishu support;
- `/upload` aliases;
- asking Codex to inspect or acknowledge the uploaded file.
