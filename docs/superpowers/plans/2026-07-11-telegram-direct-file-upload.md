# Telegram Direct File Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Telegram-only, one-shot `/upload` workflow that streams the next Document into the active project root without exposing its contents to Codex or overwriting an existing entry.

**Architecture:** A focused `UploadFileCoordinator` owns memory-only pending state and secure filesystem publication. `service.ts` intercepts `/upload`, `/cancel`, waiting text, and the next Document before media/rich-input resolution. Telegram file downloading is refactored to stream to disk, while final publication uses a same-filesystem hard link as an atomic no-clobber operation.

**Tech Stack:** TypeScript, Node.js 24 filesystem/stream APIs, Telegram Bot API, `node:test`, existing bridge command/service patterns.

---

## File Structure

- Create `src/service/upload-file-coordinator.ts`: pending-state lifecycle, filename validation, project revalidation, secure temporary download, atomic no-clobber publication, cleanup, and safe messages.
- Create `src/service/upload-file-coordinator.test.ts`: coordinator and real-filesystem security tests.
- Modify `src/telegram/api.ts`: make Telegram downloads streaming and owner-only without changing the public return contract.
- Modify `src/telegram/api.test.ts`: streaming, cleanup, and permission regressions.
- Modify `src/telegram/commands.ts` and `src/telegram/commands.test.ts`: Telegram-only `/upload` registration and help.
- Modify `src/service/command-router.ts` and `src/service/command-router.test.ts`: add the required upload handler contract.
- Modify `src/service/side-conversation-coordinator.ts` and its test: allow `/upload` in Side.
- Modify `src/service.ts` and `src/service.test.ts`: instantiate the coordinator and enforce ingress ordering/no-Codex behavior.
- Modify `docs/product/codex-command-reference.md` and `docs/product/chat-and-project-flow.md`: document current behavior and security boundary.

## Task 1: Stream Telegram Downloads Safely

**Files:**
- Modify: `src/telegram/api.ts`
- Modify: `src/telegram/api.test.ts`

- [ ] **Step 1: Write failing streaming and cleanup tests**

Add tests that serve a multi-chunk response whose second chunk is gated by a promise. Assert the destination temporary file begins receiving bytes before the response completes, proving `arrayBuffer()` is not used. Add a download-failure test that asserts both the API's internal temporary file and destination are absent, plus a POSIX-only assertion that the completed file mode is `0o600`.

```ts
test("TelegramApi streams downloads to an owner-only file", async () => {
  const firstChunkWritten = deferred<void>();
  const releaseSecondChunk = deferred<void>();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(new TextEncoder().encode("secret-"));
      firstChunkWritten.resolve();
      await releaseSecondChunk.promise;
      controller.enqueue(new TextEncoder().encode("value"));
      controller.close();
    }
  });
  // Stub fetch/getFile using the existing TelegramApi test harness.
  const downloading = api.downloadFile("file-1", destination, telegramFile);
  await firstChunkWritten.promise;
  assert.match(await readFile(findInternalTemp(root), "utf8"), /^secret-/);
  releaseSecondChunk.resolve();
  assert.equal(await downloading, destination);
  assert.equal(await readFile(destination, "utf8"), "secret-value");
  if (process.platform !== "win32") {
    assert.equal((await stat(destination)).mode & 0o777, 0o600);
  }
});
```

- [ ] **Step 2: Run the focused API tests and verify RED**

Run:

```bash
node --import tsx --test src/telegram/api.test.ts
```

Expected: the streaming test fails because `downloadFile` waits for `response.arrayBuffer()`, and the permission assertion fails because mode `0o600` is not explicitly enforced.

- [ ] **Step 3: Replace buffering with a streaming helper**

Use `Readable.fromWeb`, `createWriteStream`, and `pipeline`. Keep the existing fetch→curl fallback and public signature. Create the API-owned temporary path with exclusive mode, stream into it, then rename it to the caller-provided unique destination.

```ts
private async streamResponseToFile(response: Response, tempPath: string): Promise<void> {
  if (!response.body) throw new Error("Telegram file download returned an empty body");
  await pipeline(
    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>),
    createWriteStream(tempPath, { flags: "wx", mode: 0o600 })
  );
}
```

For curl fallback, reserve a new temporary pathname with an exclusive `open(..., "wx", 0o600)`, close and remove that reservation, invoke curl against the unpredictable pathname, then `chmod(tempPath, 0o600)` before rename. Every catch path removes the API-owned temporary file.

- [ ] **Step 4: Run API tests and type checking**

Run:

```bash
node --import tsx --test src/telegram/api.test.ts
npm run check
```

Expected: all API tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/telegram/api.ts src/telegram/api.test.ts
git commit -m "refactor: stream Telegram file downloads"
```

## Task 2: Build the Secure One-Shot Upload Coordinator

**Files:**
- Create: `src/service/upload-file-coordinator.ts`
- Create: `src/service/upload-file-coordinator.test.ts`

- [ ] **Step 1: Write failing pending-lifecycle tests**

Build a harness with a real temporary project root and narrow dependency fakes. Cover begin success, missing/archived session, duplicate begin, five-minute expiration, cancellation, repeated `/upload`, ordinary-text suppression, one-shot Document claim on success and failure, same-chat queue rejection isolation, and different-chat independence.

Define the coordinator contract in the test before implementation:

```ts
export interface UploadFileCoordinatorDeps {
  getActiveSession(chatId: string): SessionRow | null;
  getTelegramApi(): Pick<TelegramApi, "getFile" | "downloadFile"> | null;
  hasConflictingInput(chatId: string): boolean;
  safeSendMessage(chatId: string, text: string): Promise<boolean>;
  nowMs(): number;
  createToken(): string;
  logger: Pick<Logger, "info" | "warn">;
}

const coordinator = new UploadFileCoordinator(deps, { ttlMs: 300_000 });
assert.equal(await coordinator.begin("chat-1"), true);
assert.equal(coordinator.isWaiting("chat-1"), true);
assert.equal(await coordinator.cancel("chat-1"), true);
```

- [ ] **Step 2: Write failing filename/filesystem tests**

Table-test empty names, `.`, `..`, both separators, NUL/CR/LF, POSIX absolute paths, and Windows drive/UNC paths. Assert `.env` succeeds. Create an existing file, directory, and symlink at the destination and assert no mutation. Force a destination race immediately before publication and assert the racing content remains unchanged.

```ts
for (const name of ["", ".", "..", "../key", "a/b", "a\\b", "C:\\key", "\\\\host\\key", "a\0b", "a\nb"]) {
  await beginAndUpload(name);
  assert.deepEqual(await readdir(projectRoot), []);
}

await beginAndUpload(".env", "API_KEY=sensitive-value");
assert.equal(await readFile(join(projectRoot, ".env"), "utf8"), "API_KEY=sensitive-value");
```

Capture logger/message arguments and assert the sensitive bytes, Telegram `file_path`, bot token, caption, and absolute project path never appear.

- [ ] **Step 3: Run coordinator tests and verify RED**

Run:

```bash
node --import tsx --test src/service/upload-file-coordinator.test.ts
```

Expected: FAIL because `UploadFileCoordinator` does not exist.

- [ ] **Step 4: Implement state, validation, and queues**

Create memory-only maps for pending records and rejection-isolated per-chat promise queues.

```ts
interface PendingUpload {
  chatId: string;
  sessionId: string;
  projectPath: string;
  expiresAtMs: number;
}

private async enqueue<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
  const previous = this.queues.get(chatId) ?? Promise.resolve();
  const execution = previous.catch(() => undefined).then(operation);
  const tail = execution.then(() => undefined, () => undefined);
  this.queues.set(chatId, tail);
  try { return await execution; }
  finally { if (this.queues.get(chatId) === tail) this.queues.delete(chatId); }
}
```

Expose these methods:

```ts
begin(chatId: string): Promise<boolean>;
cancel(chatId: string): Promise<boolean>;
isWaiting(chatId: string): boolean;
handleWaitingText(chatId: string): Promise<boolean>;
handleDocument(chatId: string, document: TelegramDocument): Promise<boolean>;
clearForCommand(chatId: string, commandName: string): void;
cleanupAbandonedTempFiles(projectRoots: Iterable<string>): Promise<number>;
```

- [ ] **Step 5: Implement secure file publication**

Validate `file_name` without normalizing away dangerous input. Revalidate the active session before download and again before publication. Download to `.ctb-upload-${token}.tmp` inside the captured root, enforce `0o600`, then use `link(tempPath, destinationPath)` as the atomic no-clobber publish operation on the same filesystem. Unlink the temp afterward.

```ts
const tempPath = join(root, `.ctb-upload-${this.deps.createToken()}.tmp`);
try {
  const file = await api.getFile(document.file_id);
  const downloaded = await api.downloadFile(document.file_id, tempPath, file);
  if (downloaded !== tempPath) throw new Error("telegram_download_missing");
  this.assertSessionStillMatches(pending);
  await chmod(tempPath, 0o600);
  await link(tempPath, destinationPath); // EEXIST means safe refusal
  const bytes = (await stat(destinationPath)).size;
  await this.deps.safeSendMessage(chatId, this.successText(fileName, bytes));
  return true;
} finally {
  await rm(tempPath, { force: true }).catch(() => undefined);
}
```

Use `lstat` for cleanup and never follow matching symlinks. Map filesystem and Telegram failures to compact non-sensitive responses; log only safe metadata.

- [ ] **Step 6: Run coordinator tests and verify GREEN**

Run:

```bash
node --import tsx --test src/service/upload-file-coordinator.test.ts
npm run check
git diff --check
```

Expected: all coordinator tests pass, including no-clobber races and sensitive-log assertions.

- [ ] **Step 7: Commit**

```bash
git add src/service/upload-file-coordinator.ts src/service/upload-file-coordinator.test.ts
git commit -m "feat: securely save Telegram uploads"
```

## Task 3: Register `/upload` and Permit It in Side

**Files:**
- Modify: `src/telegram/commands.ts`
- Modify: `src/telegram/commands.test.ts`
- Modify: `src/service/command-router.ts`
- Modify: `src/service/command-router.test.ts`
- Modify: `src/service/side-conversation-coordinator.ts`
- Modify: `src/service/side-conversation-coordinator.test.ts`

- [ ] **Step 1: Write failing registry/router/Side tests**

Assert Telegram zh/en command sync and help contain `/upload`, Feishu excludes it, `routeBridgeCommand("upload", handlers)` calls `handleUpload` exactly once, and `isCommandAllowed("upload")` is true in Side.

```ts
assert.equal(resolveTelegramCommandHandler("upload"), "handleUpload");
assert.ok(buildTelegramCommands("zh", "telegram").some(({ command }) => command === "upload"));
assert.ok(!buildTelegramCommands("zh", "feishu").some(({ command }) => command === "upload"));
assert.equal(coordinator.isCommandAllowed("upload"), true);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --import tsx --test src/telegram/commands.test.ts src/service/command-router.test.ts src/service/side-conversation-coordinator.test.ts
```

Expected: FAIL on the missing handler and Side allowlist entry.

- [ ] **Step 3: Add the command contract**

Add `handleUpload` to `TelegramCommandHandlerKey` and required command-router handlers. Register:

```ts
{
  command: "upload",
  handler: "handleUpload",
  description: { zh: "上传文件到项目根目录", en: "Upload a file to the project root" },
  helpLines: [{
    zh: "/upload 安全保存下一份文件到项目根目录；不会发送给 Codex",
    en: "/upload Safely save the next file to the project root without sending it to Codex"
  }],
  telegramOnly: true
}
```

Add `"upload"` to `SIDE_ALLOWED_COMMANDS`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command and `npm run check`. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/telegram/commands.ts src/telegram/commands.test.ts src/service/command-router.ts src/service/command-router.test.ts src/service/side-conversation-coordinator.ts src/service/side-conversation-coordinator.test.ts
git commit -m "feat: register Telegram upload command"
```

## Task 4: Wire Upload Ingress Ahead of Codex Media

**Files:**
- Modify: `src/service.ts`
- Modify: `src/service.test.ts`

- [ ] **Step 1: Write failing service integration tests**

Extend the service harness with upload coordinator observations and real temporary roots. Cover:

- `/upload` is intercepted before pending app-server questionnaire text mode;
- rename/manual-path/rich composer reject `/upload` with `/cancel` guidance;
- `/cancel` clears upload before other cancellable modes;
- ordinary text while waiting does not call normal text, auto-attach, or app-server;
- a Document while waiting bypasses `MediaIngressService` and `RichInputAdapter`;
- a Document when not waiting retains current rich-input behavior;
- photo and voice retain current behavior and do not consume waiting state;
- another slash command clears waiting state then executes normally;
- repeated `/upload` preserves the original pending record;
- Side `/upload` saves to the shared project and starts no turn;
- Feishu `/upload` is unsupported.

```ts
test("pending upload consumes Document before Codex media routing", async () => {
  await harness.sendText("/upload");
  await harness.sendDocument({ file_id: "secret", file_name: ".env", file_size: 12 });
  assert.equal(await readFile(join(projectRoot, ".env"), "utf8"), "API_KEY=abc");
  assert.equal(harness.inboundMediaCalls.length, 0);
  assert.equal(harness.startedTurns.length, 0);
  assert.equal(harness.appServerInputs.length, 0);
});
```

- [ ] **Step 2: Run service tests and verify RED**

Run:

```bash
node --import tsx --test src/service.test.ts
```

Expected: FAIL because service does not instantiate or route `UploadFileCoordinator`.

- [ ] **Step 3: Instantiate and route the coordinator**

Instantiate after store/API dependencies exist and supply narrow delegates. Add early command handling after authorization/runtime notice flush:

```ts
if (earlyCommand?.name === "upload") {
  await this.handleUploadCommand(chatId);
  return;
}
if (earlyCommand?.name === "cancel" && this.uploadFileCoordinator.isWaiting(chatId)) {
  await this.uploadFileCoordinator.cancel(chatId);
  return;
}
```

Before voice/media resolution:

```ts
if (message.document && this.uploadFileCoordinator.isWaiting(chatId)) {
  await this.uploadFileCoordinator.handleDocument(chatId, message.document);
  return;
}
if (!earlyCommand && text && this.uploadFileCoordinator.isWaiting(chatId)) {
  await this.uploadFileCoordinator.handleWaitingText(chatId);
  return;
}
```

For any other slash command, clear the pending upload before normal routing. Keep photo and voice branches unchanged so they do not consume it. Add `handleUpload` to `routeCommand`, Telegram-only guard it, and make `handleCancelCommand` check upload state first.

- [ ] **Step 4: Implement conflict and Side project checks**

The service-level upload handler rejects rename/manual-path/rich composer and pending interaction text modes with `/cancel` guidance. The coordinator validates `SessionRow.sessionKind` but accepts both regular and Side sessions, using their shared `projectPath`. It re-reads the same active session ID and project path before publication.

- [ ] **Step 5: Run service and regression tests**

Run:

```bash
node --import tsx --test src/service.test.ts src/service/rich-input-adapter.test.ts src/service/media-ingress.test.ts
npm run check
git diff --check
```

Expected: upload integration tests and existing media/rich-input tests all pass.

- [ ] **Step 6: Commit**

```bash
git add src/service.ts src/service.test.ts
git commit -m "feat: route Telegram documents to secure upload"
```

## Task 5: Startup Cleanup, Documentation, and End-to-End Verification

**Files:**
- Modify: `src/service.ts`
- Modify: `src/service.test.ts`
- Modify: `docs/product/codex-command-reference.md`
- Modify: `docs/product/chat-and-project-flow.md`

- [ ] **Step 1: Write failing startup cleanup tests**

Seed known project roots with a regular `.ctb-upload-<uuid>.tmp`, matching symlink, matching directory, unrelated file, and active user file. Start the service and assert only bridge-owned regular temporary files are removed before polling begins. Restart and assert idempotence.

```ts
assert.equal(await pathExists(abandonedRegularTemp), false);
assert.equal(await lstat(matchingSymlink).then((s) => s.isSymbolicLink()), true);
assert.equal(await lstat(matchingDirectory).then((s) => s.isDirectory()), true);
assert.equal(await readFile(unrelatedFile, "utf8"), "keep");
```

- [ ] **Step 2: Run the startup test and verify RED**

Run the named cleanup test in `src/service.test.ts`. Expected: FAIL because startup does not call upload cleanup.

- [ ] **Step 3: Wire startup cleanup safely**

After store open and session normalization, collect distinct canonical project roots from visible sessions. Call `cleanupAbandonedTempFiles` before API polling and catch/log per-root failures so one inaccessible project cannot block startup. The cleanup implementation accepts only names matching:

```ts
const UPLOAD_TEMP_PATTERN = /^\.ctb-upload-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.tmp$/i;
```

It uses `lstat`; only regular files are unlinked.

- [ ] **Step 4: Update current-truth documentation**

Document `/upload`, one-shot/five-minute behavior, root-only destination, refusal to overwrite, `/cancel`, Side support, Telegram-only scope, and the explicit no-Codex/no-content-log boundary. Do not imply malware scanning, encryption at rest, or Feishu support.

- [ ] **Step 5: Run complete verification**

Run:

```bash
npm run check
node --import tsx --test src/telegram/api.test.ts src/telegram/commands.test.ts src/service/command-router.test.ts src/service/side-conversation-coordinator.test.ts src/service/upload-file-coordinator.test.ts src/service/rich-input-adapter.test.ts src/service/media-ingress.test.ts src/service.test.ts
npm test
npm run build
npm audit --package-lock-only
git diff --check master..HEAD
```

Expected: every command exits 0, all tests report zero failures, audit reports zero vulnerabilities, and diff check emits no output.

- [ ] **Step 6: Commit**

```bash
git add src/service.ts src/service.test.ts docs/product/codex-command-reference.md docs/product/chat-and-project-flow.md
git commit -m "docs: document secure Telegram uploads"
```

- [ ] **Step 7: Install and perform Telegram smoke verification**

Install with `/home/jingw/.local/npm-global/bin/codex`, restart the user service, and verify `ctb status` is ready. In the authorized Telegram chat:

1. send `/upload`, then a harmless uniquely named file; verify byte equality and owner-only mode locally;
2. send `/upload`, then the same filename; verify refusal and unchanged bytes;
3. send `/upload`, then ordinary text containing a sentinel; verify it does not start a Codex turn;
4. cancel and verify subsequent text follows normal routing;
5. enter `/side`, upload a harmless file, and verify neither Side nor parent receives it as input;
6. restart while `/upload` waits and verify the pending state is gone;
7. verify the installed command list includes `/upload` and Feishu command generation excludes it.

Record installed commit, service state, Codex binary/version, command-sync result, and smoke outcomes in the final handoff. Do not use a real API key in automated or smoke tests.
