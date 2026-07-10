import assert from "node:assert/strict";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  truncate,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import type { SessionRow } from "../types.js";
import {
  MAX_RETRIEVE_FILE_BYTES,
  RetrieveFileValidationError,
  resolveRetrieveFile,
  type ResolvedRetrieveFile
} from "./retrieve-file-policy.js";
import { RetrieveFileCoordinator } from "./retrieve-file-coordinator.js";

function createSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    sessionId: "session-1",
    sessionKind: "regular",
    parentSessionId: null,
    chatId: "chat-1",
    telegramChatId: "chat-1",
    threadId: "thread-1",
    selectedModel: null,
    selectedReasoningEffort: null,
    planMode: false,
    needsDefaultCollaborationModeReset: false,
    displayName: "Session One",
    displayNameSource: "manual",
    projectName: "Project One",
    projectAlias: null,
    projectPath: "/project",
    status: "idle",
    failureReason: null,
    archived: false,
    archivedAt: null,
    createdAt: "2026-07-10T00:00:00.000Z",
    lastUsedAt: "2026-07-10T00:00:00.000Z",
    lastTurnId: null,
    lastTurnStatus: "completed",
    ...overrides
  };
}

function candidate(overrides: Partial<ResolvedRetrieveFile> = {}): ResolvedRetrieveFile {
  return {
    requestedPath: "reports/audit.html",
    projectRealPath: "/project",
    targetRealPath: "/project/reports/audit.html",
    fileName: "audit.html",
    sizeBytes: 12,
    insideProject: true,
    displayPath: "reports/audit.html",
    identity: {
      dev: 1,
      ino: 1,
      mtimeMs: 1,
      sizeBytes: 12
    },
    ...overrides
  };
}

function createHarness(initialResult: ResolvedRetrieveFile = candidate()) {
  let activeSession: SessionRow | null = createSession();
  let documentResult = true;
  let messageResult = true;
  let now = 1_000;
  let tokenNumber = 0;
  let timerNumber = 0;
  let resolver: (options: { rawPath: string; projectPath: string; homeDir: string }) => Promise<ResolvedRetrieveFile> = async () => initialResult;
  const resolverCalls: Array<{ rawPath: string; projectPath: string; homeDir: string }> = [];
  const messages: Array<{
    chatId: string;
    text: string;
    replyMarkup?: TelegramInlineKeyboardMarkup;
  }> = [];
  const documents: Array<{
    chatId: string;
    filePath: string;
    fileName: string;
    caption: string;
  }> = [];
  const warnings: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const timers: Array<{
    id: number;
    callback: () => void;
    delayMs: number;
    canceled: boolean;
    unrefCalled: boolean;
  }> = [];

  const coordinator = new RetrieveFileCoordinator({
    homeDir: "/home/tester",
    logger: {
      warn: async (message, meta) => {
        warnings.push({ message, ...(meta ? { meta } : {}) });
      }
    },
    getStore: () => ({
      getActiveSession: (chatId) => activeSession?.chatId === chatId ? activeSession : null
    }),
    safeSendMessage: async (chatId, text, replyMarkup) => {
      messages.push({ chatId, text, ...(replyMarkup ? { replyMarkup } : {}) });
      return messageResult;
    },
    sendDocument: async (chatId, filePath, options) => {
      documents.push({ chatId, filePath, fileName: options.fileName, caption: options.caption });
      return documentResult;
    },
    createSnapshot: async (resolved) => ({
      filePath: `/staged/${resolved.fileName}`,
      sizeBytes: resolved.sizeBytes,
      cleanup: async () => {}
    }),
    resolveFile: async (options) => {
      resolverCalls.push(options);
      return await resolver(options);
    },
    now: () => now,
    createToken: () => `token-${++tokenNumber}`,
    scheduleTimer: (callback, delayMs) => {
      const timer = {
        id: ++timerNumber,
        callback,
        delayMs,
        canceled: false,
        unrefCalled: false,
        unref() { this.unrefCalled = true; }
      };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      (timer as { canceled: boolean }).canceled = true;
    }
  });

  return {
    coordinator,
    documents,
    messages,
    resolverCalls,
    timers,
    warnings,
    advanceTime: (milliseconds: number) => { now += milliseconds; },
    setActiveSession: (session: SessionRow | null) => { activeSession = session; },
    setDocumentResult: (result: boolean) => { documentResult = result; },
    setMessageResult: (result: boolean) => { messageResult = result; },
    setResolver: (next: typeof resolver) => { resolver = next; },
    fireTimer: (index: number) => { timers[index]?.callback(); }
  };
}

function confirmationToken(message: { replyMarkup?: TelegramInlineKeyboardMarkup }): string {
  const callbackData = message.replyMarkup?.inline_keyboard[0]?.[0]?.callback_data ?? "";
  const match = /^v10:rt:y:(.+)$/u.exec(callbackData);
  assert.ok(match, `expected retrieve confirmation callback, received ${callbackData}`);
  return match[1] ?? "";
}

test("project files send directly", async () => {
  const h = createHarness();

  await h.coordinator.handleCommand("chat-1", "reports/audit.html");

  assert.deepEqual(h.resolverCalls, [{
    rawPath: "reports/audit.html",
    projectPath: "/project",
    homeDir: "/home/tester"
  }]);
  assert.deepEqual(h.documents, [{
    chatId: "chat-1",
    filePath: "/staged/audit.html",
    fileName: "audit.html",
    caption: "Retrieved: reports/audit.html\nSize: 12 B"
  }]);
  assert.deepEqual(h.messages, []);
});

test("retrieve requires an active non-archived session", async () => {
  const h = createHarness();
  h.setActiveSession(null);

  await h.coordinator.handleCommand("chat-1", "audit.html");
  assert.equal(h.messages.at(-1)?.text, "请先发送 /new 选择项目。");

  h.setActiveSession(createSession({ archived: true }));
  await h.coordinator.handleCommand("chat-1", "audit.html");
  assert.equal(h.messages.at(-1)?.text, "请先发送 /new 选择项目。");
  assert.deepEqual(h.documents, []);
  assert.deepEqual(h.resolverCalls, []);
});

test("retrieve surfaces validation messages without logging internals", async () => {
  const h = createHarness();
  h.setResolver(async () => {
    throw new RetrieveFileValidationError("not_found", "找不到指定的文件。");
  });

  await h.coordinator.handleCommand("chat-1", "missing.html");

  assert.equal(h.messages.at(-1)?.text, "找不到指定的文件。");
  assert.deepEqual(h.documents, []);
  assert.deepEqual(h.warnings, []);
});

test("direct upload failures send feedback", async () => {
  const h = createHarness();
  h.setDocumentResult(false);

  await h.coordinator.handleCommand("chat-1", "reports/audit.html");

  assert.equal(h.documents.length, 1);
  assert.equal(h.messages.at(-1)?.text, "文件上传失败，请稍后重试。");
});

test("direct delivery uses a bounded caption that preserves the path tail and size", async () => {
  const pathTail = "tail/report.html";
  const h = createHarness(candidate({
    displayPath: `${"deep/".repeat(250)}${pathTail}`,
    sizeBytes: 1536
  }));

  await h.coordinator.handleCommand("chat-1", "long-path");

  const caption = h.documents[0]?.caption ?? "";
  assert.ok(caption.length <= 900);
  assert.match(caption, /tail\/report\.html\nSize: 1\.5 KiB$/u);
});

test("unexpected resolver failures are logged and receive generic safe feedback", async () => {
  const h = createHarness();
  h.setResolver(async () => {
    throw new Error("secret filesystem detail");
  });

  await h.coordinator.handleCommand("chat-1", "audit.html");

  assert.equal(h.messages.at(-1)?.text, "文件取回失败，请稍后重试。");
  assert.equal(h.messages.at(-1)?.text.includes("secret"), false);
  assert.equal(h.warnings.length, 1);
  assert.deepEqual(h.documents, []);
});

test("external approval warns with bound details, revalidates, and sends once", async () => {
  const external = candidate({
    requestedPath: "/tmp/audit.html",
    targetRealPath: "/tmp/audit.html",
    insideProject: false,
    displayPath: "/tmp/audit.html",
    sizeBytes: 1536
  });
  const h = createHarness(external);

  await h.coordinator.handleCommand("chat-1", "/tmp/audit.html");

  assert.deepEqual(h.documents, []);
  const warning = h.messages.at(-1);
  assert.match(warning?.text ?? "", /项目外/u);
  assert.match(warning?.text ?? "", /\/tmp\/audit\.html/u);
  assert.match(warning?.text ?? "", /1\.5 KiB/u);
  assert.match(warning?.text ?? "", /\/project/u);
  assert.deepEqual(warning?.replyMarkup?.inline_keyboard[0]?.map((button) => button.text), ["确认发送", "取消"]);
  const token = confirmationToken(warning ?? {});

  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "文件已发送。");
  assert.equal(h.resolverCalls.length, 2);
  assert.equal(h.resolverCalls[1]?.rawPath, "/tmp/audit.html");
  assert.equal(h.documents.length, 1);
  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "这个确认已失效。");
  assert.equal(h.documents.length, 1);
});

test("external warnings bound huge target and project paths under 4000 characters", async () => {
  const targetTail = "/target-tail/audit.html";
  const projectTail = "/project-tail";
  const h = createHarness(candidate({
    requestedPath: "/outside/audit.html",
    targetRealPath: `/${"t".repeat(10_000)}${targetTail}`,
    projectRealPath: "/real-project",
    insideProject: false,
    displayPath: "/outside/audit.html"
  }));
  h.setActiveSession(createSession({ projectPath: `/${"p".repeat(10_000)}${projectTail}` }));

  await h.coordinator.handleCommand("chat-1", "/outside/audit.html");

  const warning = h.messages.at(-1)?.text ?? "";
  assert.ok(warning.length <= 4_000);
  assert.match(warning, /target-tail\/audit\.html/u);
  assert.match(warning, /project-tail/u);
});

test("external confirmation cancellation and 120001 ms expiry never upload", async () => {
  const external = candidate({ insideProject: false, targetRealPath: "/tmp/a.html", displayPath: "/tmp/a.html" });
  const canceled = createHarness(external);
  await canceled.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const canceledToken = confirmationToken(canceled.messages.at(-1) ?? {});
  assert.equal(await canceled.coordinator.handleDecision("chat-1", canceledToken, false), "已取消。");
  assert.deepEqual(canceled.documents, []);

  const expired = createHarness(external);
  await expired.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const expiredToken = confirmationToken(expired.messages.at(-1) ?? {});
  expired.advanceTime(120_001);
  assert.equal(await expired.coordinator.handleDecision("chat-1", expiredToken, true), "这个确认已过期。");
  assert.deepEqual(expired.documents, []);
});

test("pending confirmation expires independently without a follow-up coordinator action", async () => {
  const h = createHarness(candidate({ insideProject: false, targetRealPath: "/tmp/a.html" }));
  await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const token = confirmationToken(h.messages.at(-1) ?? {});

  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0]?.delayMs, 120_000);
  assert.equal(h.timers[0]?.unrefCalled, true);
  h.advanceTime(120_001);
  h.fireTimer(0);

  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "这个确认已失效。");
  assert.deepEqual(h.documents, []);
});

test("confirmation timers are canceled on consume and replacement", async () => {
  const h = createHarness(candidate({ insideProject: false, targetRealPath: "/tmp/a.html" }));
  await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const firstToken = confirmationToken(h.messages.at(-1) ?? {});
  assert.equal(await h.coordinator.handleDecision("chat-1", firstToken, false), "已取消。");
  assert.equal(h.timers[0]?.canceled, true);

  await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
  await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
  assert.equal(h.timers[1]?.canceled, true);
  assert.equal(h.timers[2]?.canceled, false);
});

test("a wrong chat consumes the external confirmation", async () => {
  const h = createHarness(candidate({ insideProject: false, targetRealPath: "/tmp/a.html" }));
  await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const token = confirmationToken(h.messages.at(-1) ?? {});

  assert.equal(await h.coordinator.handleDecision("chat-2", token, true), "这个确认已失效。");
  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "这个确认已失效。");
  assert.deepEqual(h.documents, []);
});

test("approval rejects changed, missing, or archived active sessions and changed projects", async () => {
  const external = candidate({ insideProject: false, targetRealPath: "/tmp/a.html" });
  for (const nextSession of [
    null,
    createSession({ sessionId: "session-2" }),
    createSession({ archived: true }),
    createSession({ projectPath: "/other-project" })
  ]) {
    const h = createHarness(external);
    await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
    const token = confirmationToken(h.messages.at(-1) ?? {});
    h.setActiveSession(nextSession);
    assert.equal(
      await h.coordinator.handleDecision("chat-1", token, true),
      "当前会话或项目已改变，未发送文件。"
    );
    assert.deepEqual(h.documents, []);
  }
});

test("approval rejects changed project real paths and target real paths", async () => {
  const external = candidate({ insideProject: false, targetRealPath: "/tmp/a.html", displayPath: "/tmp/a.html" });

  const changedProject = createHarness(external);
  await changedProject.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const projectToken = confirmationToken(changedProject.messages.at(-1) ?? {});
  changedProject.setResolver(async () => ({ ...external, projectRealPath: "/moved-project" }));
  assert.equal(
    await changedProject.coordinator.handleDecision("chat-1", projectToken, true),
    "当前会话或项目已改变，未发送文件。"
  );

  const changedTarget = createHarness(external);
  await changedTarget.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const targetToken = confirmationToken(changedTarget.messages.at(-1) ?? {});
  changedTarget.setResolver(async () => ({ ...external, targetRealPath: "/tmp/b.html" }));
  assert.equal(
    await changedTarget.coordinator.handleDecision("chat-1", targetToken, true),
    "文件路径已改变，请重新使用 /retrieve。"
  );
  assert.deepEqual(changedProject.documents, []);
  assert.deepEqual(changedTarget.documents, []);
});

test("approval safely reports deleted, unreadable, and newly oversized files", async () => {
  const cases = [
    new RetrieveFileValidationError("not_found", "找不到指定的文件。"),
    new RetrieveFileValidationError("unreadable", "无法读取该文件，请检查文件权限。"),
    new RetrieveFileValidationError("too_large", "文件大小为 50.1 MiB（52533658 B），超过 50 MiB 限制。", 52_533_658)
  ];

  for (const validationError of cases) {
    const h = createHarness(candidate({ insideProject: false, targetRealPath: "/tmp/a.html" }));
    await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
    const token = confirmationToken(h.messages.at(-1) ?? {});
    h.setResolver(async () => { throw validationError; });

    assert.equal(await h.coordinator.handleDecision("chat-1", token, true), validationError.message);
    assert.deepEqual(h.documents, []);
  }
});

test("approval reports upload failure and remains single-use", async () => {
  const h = createHarness(candidate({ insideProject: false, targetRealPath: "/tmp/a.html" }));
  h.setDocumentResult(false);
  await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const token = confirmationToken(h.messages.at(-1) ?? {});

  assert.equal(
    await h.coordinator.handleDecision("chat-1", token, true),
    "文件上传失败，请稍后重试。"
  );
  assert.equal(h.documents.length, 1);
  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "这个确认已失效。");
});

test("a newer external request replaces the older confirmation for the same chat and session", async () => {
  const first = candidate({ requestedPath: "/tmp/first.html", targetRealPath: "/tmp/first.html", insideProject: false });
  const second = candidate({ requestedPath: "/tmp/second.html", targetRealPath: "/tmp/second.html", insideProject: false });
  const h = createHarness(first);
  await h.coordinator.handleCommand("chat-1", "/tmp/first.html");
  const firstToken = confirmationToken(h.messages.at(-1) ?? {});
  h.setResolver(async () => second);
  await h.coordinator.handleCommand("chat-1", "/tmp/second.html");
  const secondToken = confirmationToken(h.messages.at(-1) ?? {});

  assert.equal(await h.coordinator.handleDecision("chat-1", firstToken, true), "这个确认已失效。");
  assert.equal(await h.coordinator.handleDecision("chat-1", secondToken, true), "文件已发送。");
  assert.equal(h.documents[0]?.filePath, "/staged/audit.html");
});

test("failed warning delivery deletes the pending confirmation", async () => {
  const h = createHarness(candidate({ insideProject: false, targetRealPath: "/tmp/a.html" }));
  h.setMessageResult(false);
  await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const token = confirmationToken(h.messages.at(-1) ?? {});

  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "这个确认已失效。");
  assert.deepEqual(h.documents, []);
});

test("unexpected approval failures are logged and return generic safe feedback", async () => {
  const h = createHarness(candidate({ insideProject: false, targetRealPath: "/tmp/a.html" }));
  await h.coordinator.handleCommand("chat-1", "/tmp/a.html");
  const token = confirmationToken(h.messages.at(-1) ?? {});
  h.setResolver(async () => { throw new Error("secret revalidation failure"); });

  assert.equal(await h.coordinator.handleDecision("chat-1", token, true), "文件取回失败，请稍后重试。");
  assert.equal(h.warnings.length, 1);
  assert.deepEqual(h.documents, []);
});

test("path substitution after validation never uploads replacement content", async () => {
  const root = await mkdtemp(join(tmpdir(), "retrieve-snapshot-substitution-"));
  const project = join(root, "project");
  const target = join(project, "report.txt");
  await mkdir(project);
  await writeFile(target, "validated safe content", { mode: 0o600 });
  const sentContents: string[] = [];
  const messages: string[] = [];
  let session = createSession({ projectPath: project });

  const coordinator = new RetrieveFileCoordinator({
    homeDir: root,
    logger: { warn: async () => {} },
    getStore: () => ({ getActiveSession: () => session }),
    safeSendMessage: async (_chatId, text) => { messages.push(text); return true; },
    sendDocument: async (_chatId, filePath) => {
      sentContents.push(await readFile(filePath, "utf8"));
      return true;
    },
    resolveFile: async (options) => {
      const resolved = await resolveRetrieveFile(options);
      await rename(target, join(project, "validated-old.txt"));
      await writeFile(target, "sensitive replacement", { mode: 0o600 });
      return resolved;
    }
  });

  try {
    await coordinator.handleCommand("chat-1", "report.txt");
    assert.deepEqual(sentContents, []);
    assert.equal(messages.at(-1), "文件路径已改变，请重新使用 /retrieve。");
  } finally {
    session = createSession();
    await rm(root, { recursive: true, force: true });
  }
});

test("snapshot bytes stay immutable during upload and staging is private and cleaned after success", async () => {
  const root = await mkdtemp(join(tmpdir(), "retrieve-snapshot-success-"));
  const project = join(root, "project");
  const target = join(project, "report.txt");
  await mkdir(project);
  await writeFile(target, "validated safe content", { mode: 0o600 });
  let stagedPath = "";
  let stagedContent = "";
  let stagedMode = 0;

  const coordinator = new RetrieveFileCoordinator({
    homeDir: root,
    logger: { warn: async () => {} },
    getStore: () => ({ getActiveSession: () => createSession({ projectPath: project }) }),
    safeSendMessage: async () => true,
    sendDocument: async (_chatId, filePath) => {
      stagedPath = filePath;
      await writeFile(target, "mutated sensitive content");
      stagedContent = await readFile(filePath, "utf8");
      stagedMode = (await stat(filePath)).mode & 0o777;
      return true;
    }
  });

  try {
    await coordinator.handleCommand("chat-1", "report.txt");
    assert.notEqual(stagedPath, target);
    assert.equal(stagedContent, "validated safe content");
    assert.equal(stagedMode, 0o600);
    await assert.rejects(() => access(stagedPath, constants.F_OK), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("staging is cleaned after upload failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "retrieve-snapshot-failure-"));
  const project = join(root, "project");
  const target = join(project, "report.txt");
  await mkdir(project);
  await writeFile(target, "safe content", { mode: 0o600 });
  let stagedPath = "";

  const coordinator = new RetrieveFileCoordinator({
    homeDir: root,
    logger: { warn: async () => {} },
    getStore: () => ({ getActiveSession: () => createSession({ projectPath: project }) }),
    safeSendMessage: async () => true,
    sendDocument: async (_chatId, filePath) => { stagedPath = filePath; return false; }
  });

  try {
    await coordinator.handleCommand("chat-1", "report.txt");
    await assert.rejects(() => access(stagedPath, constants.F_OK), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("growth beyond the limit after validation returns the stable size error without upload", async () => {
  const root = await mkdtemp(join(tmpdir(), "retrieve-snapshot-growth-"));
  const project = join(root, "project");
  const target = join(project, "report.bin");
  await mkdir(project);
  await writeFile(target, "safe", { mode: 0o600 });
  const messages: string[] = [];
  let uploadCount = 0;

  const coordinator = new RetrieveFileCoordinator({
    homeDir: root,
    logger: { warn: async () => {} },
    getStore: () => ({ getActiveSession: () => createSession({ projectPath: project }) }),
    safeSendMessage: async (_chatId, text) => { messages.push(text); return true; },
    sendDocument: async () => { uploadCount += 1; return true; },
    resolveFile: async (options) => {
      const resolved = await resolveRetrieveFile(options);
      await truncate(target, MAX_RETRIEVE_FILE_BYTES + 1);
      return resolved;
    }
  });

  try {
    await coordinator.handleCommand("chat-1", "report.bin");
    assert.equal(uploadCount, 0);
    assert.match(messages.at(-1) ?? "", /超过 50 MiB 限制/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
