# Telegram /retrieve File Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add a Telegram-only /retrieve <file path> command that sends one local regular file, with confirmation for paths outside the active project.

**Architecture:** A filesystem-only policy resolves and validates paths. RetrieveFileCoordinator owns delivery, external-file confirmations, revalidation, and feedback. Existing registries and BridgeService connect it to Telegram document delivery.

**Tech Stack:** TypeScript, Node.js filesystem/path APIs, Node test runner, Telegram Bot API.

---

## Files

- Create src/service/retrieve-file-policy.ts and its test.
- Create src/service/retrieve-file-coordinator.ts and its test.
- Modify Telegram callback/command registries and tests.
- Modify src/service.ts, src/service.test.ts, and command documentation.

### Task 1: Filesystem policy

**Files:**
- Create: src/service/retrieve-file-policy.ts
- Create: src/service/retrieve-file-policy.test.ts
- Modify: src/telegram/ui-callbacks.ts
- Modify: src/telegram/ui.test.ts

- [ ] **Step 1: Write failing real-filesystem tests**

Create a temporary home/project fixture with normal and spaced report names, external report, escaping symlink, directory, unreadable file, FIFO from mkfifo, and a sparse 50 MiB + 1 byte file.

~~~ts
test("resolves relative, quoted, and home paths", async () => {
  const f = await createFixture();
  try {
    const a = await resolveRetrieveFile({ rawPath: "reports/audit.html", projectPath: f.project, homeDir: f.home });
    const b = await resolveRetrieveFile({ rawPath: "'reports/audit report.html'", projectPath: f.project, homeDir: f.home });
    const c = await resolveRetrieveFile({ rawPath: "~/outside.html", projectPath: f.project, homeDir: f.home });
    assert.equal(a.insideProject, true);
    assert.equal(b.fileName, "audit report.html");
    assert.equal(c.insideProject, false);
  } finally {
    await f.cleanup();
  }
});
~~~

Add a symlink-escape test asserting insideProject=false and targetRealPath equals the external real path. Add table-driven empty, missing, directory, FIFO, unreadable, and oversized rejection tests asserting empty_path, not_found, not_regular_file, not_regular_file, unreadable, and too_large. Skip chmod/FIFO only where unsupported.

- [ ] **Step 2: Verify RED**

~~~bash
node --import tsx --test src/service/retrieve-file-policy.test.ts
~~~

Expected: module-not-found.

- [ ] **Step 3: Implement contracts and validation**

~~~ts
export const MAX_RETRIEVE_FILE_BYTES = 50 * 1024 * 1024;
export type RetrieveFileErrorCode =
  | "empty_path" | "project_not_found" | "not_found"
  | "unreadable" | "not_regular_file" | "too_large";

export class RetrieveFileValidationError extends Error {
  constructor(readonly code: RetrieveFileErrorCode, message: string, readonly sizeBytes?: number) {
    super(message);
  }
}

export interface ResolvedRetrieveFile {
  requestedPath: string;
  projectRealPath: string;
  targetRealPath: string;
  fileName: string;
  sizeBytes: number;
  insideProject: boolean;
  displayPath: string;
}
~~~

Implement resolveRetrieveFile using realpath for project/target, access(constants.R_OK), and stat().isFile(). Strip one matching outer quote pair; expand only ~ and ~/; resolve other relative input against the real project. Reject over MAX_RETRIEVE_FILE_BYTES.

Containment must be component-aware:

~~~ts
const projectRelative = relative(projectRealPath, targetRealPath);
const insideProject = projectRelative === ""
  || (!projectRelative.startsWith(".." + sep) && projectRelative !== ".." && !isAbsolute(projectRelative));
~~~

Return project-relative displayPath for contained files and real absolute paths otherwise. Export formatRetrieveFileSize with B/KiB/MiB. Use explicit safe Chinese messages, including actual size for too_large.

- [ ] **Step 4: Verify policy GREEN**

~~~bash
node --import tsx --test src/service/retrieve-file-policy.test.ts
npm run check
~~~

- [ ] **Step 5: Write and verify a failing callback-encoder test**

Import the two missing encoders and assert exact compact output plus the 64-byte limit:

~~~ts
test("retrieve callback encoders stay compact", () => {
  assert.equal(encodeRetrieveConfirmCallback("tok123"), "v10:rt:y:tok123");
  assert.equal(encodeRetrieveCancelCallback("tok123"), "v10:rt:n:tok123");
});
~~~

Run the matching test. Expected: missing exports.

- [ ] **Step 6: Add only the encoder functions**

~~~ts
export function encodeRetrieveConfirmCallback(token: string): string {
  return ensureTelegramCallbackDataLimit("v10:rt:y:" + token);
}

export function encodeRetrieveCancelCallback(token: string): string {
  return ensureTelegramCallbackDataLimit("v10:rt:n:" + token);
}
~~~

Task 3 will add callback parsing and router variants after its failing integration tests.

- [ ] **Step 7: Verify and commit policy plus encoders**

~~~bash
node --import tsx --test src/service/retrieve-file-policy.test.ts src/telegram/ui.test.ts
npm run check
git add src/service/retrieve-file-policy.ts src/service/retrieve-file-policy.test.ts src/telegram/ui-callbacks.ts src/telegram/ui.test.ts
git commit -m "feat: validate retrieve file paths"
~~~

### Task 2: Coordinator

**Files:**
- Create: src/service/retrieve-file-coordinator.ts
- Create: src/service/retrieve-file-coordinator.test.ts

- [ ] **Step 1: Write failing direct-delivery tests**

Use a deterministic active SessionRow, injected resolver, recorded messages/documents/logs, mutable clock, and sequential tokens.

~~~ts
test("project files send directly", async () => {
  const h = createHarness(candidate({ insideProject: true, displayPath: "reports/audit.html" }));
  await h.coordinator.handleCommand("chat-1", "reports/audit.html");
  assert.deepEqual(h.documents, [{
    chatId: "chat-1",
    filePath: "/project/reports/audit.html",
    fileName: "audit.html",
    caption: "Retrieved: reports/audit.html\nSize: 12 B"
  }]);
});
~~~

Add missing/archived session, validation passthrough, upload failure, and caption <=900 characters tests.

- [ ] **Step 2: Verify RED**

~~~bash
node --import tsx --test src/service/retrieve-file-coordinator.test.ts
~~~

Expected: module-not-found.

- [ ] **Step 3: Implement direct delivery**

~~~ts
export interface RetrieveFileCoordinatorDeps {
  homeDir: string;
  logger: { warn(message: string, meta?: Record<string, unknown>): Promise<void> };
  getStore(): { getActiveSession(chatId: string): SessionRow | null } | null;
  safeSendMessage(chatId: string, text: string, replyMarkup?: TelegramInlineKeyboardMarkup): Promise<boolean>;
  sendDocument(chatId: string, filePath: string, options: { caption: string; fileName: string }): Promise<boolean>;
  resolveFile?: typeof resolveRetrieveFile;
  now?: () => number;
  createToken?: () => string;
}
~~~

Implement handleCommand: require active non-archived session, resolve, deliver contained files, surface validation messages, log unexpected errors, and preserve path tail plus Size suffix in a <=900-character caption.

- [ ] **Step 4: Verify direct flow GREEN**

~~~bash
node --import tsx --test src/service/retrieve-file-coordinator.test.ts
npm run check
~~~

- [ ] **Step 5: Write failing confirmation/revalidation tests**

~~~ts
test("external approval revalidates and sends once", async () => {
  const h = createHarness(candidate({ insideProject: false, targetRealPath: "/tmp/audit.html" }));
  await h.coordinator.handleCommand("chat-1", "/tmp/audit.html");
  assert.equal(h.documents.length, 0);
  const message = h.messages.at(-1);
  assert.match(message?.text ?? "", /项目外/u);
  const token = confirmationToken(message);
  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "文件已发送。");
  assert.equal(h.documents.length, 1);
  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "这个确认已失效。");
});
~~~

Assert warning contains real path, size, and project. Add cancellation, 120001 ms expiry, wrong chat, changed session/project/realpath, deletion, unreadability, size increase, upload failure, newer-confirmation replacement, and failed warning delivery. Rejections send no document.

- [ ] **Step 6: Verify RED**

Run the coordinator test. Expected: confirmation and handleDecision are missing.

- [ ] **Step 7: Implement lifecycle**

Bind pending state to chat, session id, project path, requested path, real path, and two-minute expiry. Replace older same-chat/session entries; prune expired entries. Callback data holds only an opaque token. Consume before validation, re-read session, re-resolve file, and require all bindings to match.

Stable results: 这个确认已失效。, 这个确认已过期。, 已取消。, 当前会话或项目已改变，未发送文件。, 文件路径已改变，请重新使用 /retrieve。, 文件已发送。, 文件上传失败，请稍后重试。 Log unexpected errors and return a safe generic message.

- [ ] **Step 8: Verify and commit**

~~~bash
node --import tsx --test src/service/retrieve-file-policy.test.ts src/service/retrieve-file-coordinator.test.ts
npm run check
git add src/service/retrieve-file-coordinator.ts src/service/retrieve-file-coordinator.test.ts
git commit -m "feat: coordinate Telegram file retrieval"
~~~

### Task 3: Callback, command, and service integration

**Files:**
- Modify: src/telegram/ui-callbacks.ts
- Modify: src/telegram/ui.test.ts
- Modify: src/service/callback-router.ts
- Modify: src/service/callback-router.test.ts
- Modify: src/telegram/commands.ts
- Modify: src/service/command-router.test.ts
- Modify: src/service.ts
- Modify: src/service.test.ts

- [ ] **Step 1: Write all failing integration tests**

Add compact callback round trips for v10:rt:y:<token> and v10:rt:n:<token>. Add router cases calling handleRetrieveDecision(token, true/false). Add command test asserting retrieve maps to handleRetrieve and appears in TELEGRAM_COMMANDS.

Add service tests using real files/fake API: project-relative report sends once; external absolute report sends only after callback approval; Feishu never calls document delivery and returns existing unsupported feedback.

- [ ] **Step 2: Verify RED**

~~~bash
node --import tsx --test --test-name-pattern="retrieve" src/telegram/ui.test.ts src/service/callback-router.test.ts src/service/command-router.test.ts src/service.test.ts
~~~

Expected: codec, router, registry, and service assertions fail.

- [ ] **Step 3: Implement codec/router**

Extend ParsedCallbackData with retrieve_confirm/retrieve_cancel. Encode via ensureTelegramCallbackDataLimit using v10:rt:y/n and parse those forms. Add handleRetrieveDecision to BridgeCallbackRouterHandlers and dispatch both variants. Update handler factories.

- [ ] **Step 4: Register command**

Add handleRetrieve to TelegramCommandHandlerKey and:

~~~ts
{
  command: "retrieve",
  handler: "handleRetrieve",
  description: { zh: "发送本地文件到聊天", en: "Send a local file to this chat" },
  helpLines: [{
    zh: "/retrieve <文件路径> 发送当前项目文件；项目外文件需要确认",
    en: "/retrieve <file path> Send a project file; external files require confirmation"
  }]
}
~~~

- [ ] **Step 5: Construct and route coordinator**

~~~ts
this.retrieveFileCoordinator = new RetrieveFileCoordinator({
  homeDir: this.paths.homeDir,
  logger: this.loggerAdapter,
  getStore: () => this.store,
  safeSendMessage: async (chatId, text, replyMarkup) => this.safeSendMessage(chatId, text, replyMarkup),
  sendDocument: async (chatId, filePath, options) => Boolean(
    await this.safeSendDocumentResult(chatId, filePath, options)
  )
});
~~~

Route command only for activePack==="telegram"; otherwise send buildUnsupportedCommandText(). Route callback decisions to handleDecision and answer with its result.

- [ ] **Step 6: Verify GREEN and commit**

~~~bash
node --import tsx --test src/telegram/ui.test.ts src/service/callback-router.test.ts src/service/command-router.test.ts src/service.test.ts
npm run check
git add src/telegram/ui-callbacks.ts src/telegram/ui.test.ts src/service/callback-router.ts src/service/callback-router.test.ts src/telegram/commands.ts src/service/command-router.test.ts src/service.ts src/service.test.ts
git commit -m "feat: deliver retrieved files through Telegram"
~~~

### Task 4: Docs, review, verification, install, push

**Files:**
- Modify: docs/product/codex-command-reference.md

- [ ] **Step 1: Document behavior**

Document active-project relative resolution, immediate contained delivery, two-minute confirmation for external files/escaping symlinks, regular readable files only, 50 MiB maximum, and Telegram-only scope.

- [ ] **Step 2: Commit docs**

~~~bash
git add docs/product/codex-command-reference.md
git commit -m "docs: explain Telegram file retrieval"
~~~

- [ ] **Step 3: Verify**

~~~bash
git diff --check
npm audit --package-lock-only
npm run check
npm test
npm run build
git status --short
~~~

Expected: zero vulnerabilities, full pass/build, clean status.

- [ ] **Step 4: Independent security review**

Use requesting-code-review against base 068c269 and feature HEAD. Review containment, symlinks, callback binding/single-use, TOCTOU revalidation, Telegram-only routing, size enforcement, and path leakage. Fix Critical/Important issues with failing tests first.

- [ ] **Step 5: Re-run Step 3**

Require fresh success after review fixes.

- [ ] **Step 6: Install and diagnose**

~~~bash
node dist/cli.js install
~/.local/share/codex-telegram-bridge/bin/ctb doctor
systemctl --user is-active codex-telegram-bridge.service
~~~

Expected: readiness=ready, issues=none, active.

- [ ] **Step 7: Telegram smoke**

Send contained HTML (immediate), small external file (confirm then exactly once), directory and oversized file (both rejected).

- [ ] **Step 8: Push**

~~~bash
git push -u origin feat/telegram-retrieve-file
~~~

- [ ] **Step 9: Finish branch**

Use finishing-a-development-branch; preserve worktree unless user selects removal.
