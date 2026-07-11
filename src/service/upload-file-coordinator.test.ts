import assert from "node:assert/strict";
import { chmod, lstat, mkdtemp, mkdir, open, readFile, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { TelegramDocument } from "../telegram/api.js";
import type { SessionRow } from "../types.js";
import {
  MAX_UPLOAD_FILE_BYTES,
  UPLOAD_TEMP_ABANDONMENT_MS,
  UploadFileCoordinator
} from "./upload-file-coordinator.js";

function session(projectPath: string, overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    sessionId: "session-1", sessionKind: "regular", parentSessionId: null,
    chatId: "chat-1", telegramChatId: "chat-1", threadId: null,
    selectedModel: null, selectedReasoningEffort: null, planMode: false,
    needsDefaultCollaborationModeReset: false, displayName: "project",
    displayNameSource: "auto", projectName: "project", projectAlias: null,
    projectPath, status: "idle", failureReason: null, archived: false,
    archivedAt: null, createdAt: "2026-01-01T00:00:00Z",
    lastUsedAt: "2026-01-01T00:00:00Z", lastTurnId: null, lastTurnStatus: null,
    ...overrides
  };
}

async function fixture(options: { conflict?: boolean; now?: () => number } = {}) {
  const root = await mkdtemp(join(tmpdir(), "ctb-upload-test-"));
  const messages: string[] = [];
  const logs: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  let active: SessionRow | null = session(root);
  let download: (fileId: string, path: string) => Promise<string | null> = async (_id, path) => {
    await writeFile(path, Buffer.from([0, 1, 2, 255]));
    return path;
  };
  const coordinator = new UploadFileCoordinator({
    getActiveSession: (chatId) => active && active.chatId === chatId ? active : null,
    hasConflictingInput: () => options.conflict ?? false,
    getApi: () => ({
      getFile: async (fileId) => ({ file_id: fileId, file_path: "documents/private-token" }),
      downloadFile: async (fileId, path) => await download(fileId, path)
    }),
    safeSendMessage: async (_chatId, text) => { messages.push(text); return true; },
    logger: { warn: async (message, meta) => { logs.push({ message, ...(meta ? { meta } : {}) }); } },
    ...(options.now ? { now: options.now } : {})
  });
  return {
    root, messages, logs, coordinator,
    setActive(value: SessionRow | null) { active = value; },
    setDownload(value: typeof download) { download = value; }
  };
}

const doc = (file_name: string | undefined = "secret.bin"): TelegramDocument => ({
  file_id: "telegram-file-id", file_name, file_size: 4
});

test("begin accepts regular and side sessions, while rejecting missing, archived, conflicting, and unwritable sessions", async () => {
  const f = await fixture();
  assert.equal(await f.coordinator.begin("chat-1"), true);
  f.coordinator.cancel("chat-1");
  f.setActive(session(f.root, { sessionKind: "side", parentSessionId: "parent" }));
  assert.equal(await f.coordinator.begin("chat-1"), true);
  f.coordinator.cancel("chat-1");
  f.setActive(session(f.root, { archived: true }));
  assert.equal(await f.coordinator.begin("chat-1"), false);
  f.setActive(null);
  assert.equal(await f.coordinator.begin("chat-1"), false);
  const conflicting = await fixture({ conflict: true });
  assert.equal(await conflicting.coordinator.begin("chat-1"), false);
  f.setActive(session(join(f.root, "missing")));
  assert.equal(await f.coordinator.begin("chat-1"), false);
  await chmod(f.root, 0o555);
  f.setActive(session(f.root));
  assert.equal(await f.coordinator.begin("chat-1"), false);
  await chmod(f.root, 0o700);
});

test("duplicate begin preserves pending state; cancel, commands, reminders, and TTL behave safely", async () => {
  let now = 10;
  const f = await fixture({ now: () => now });
  assert.equal(await f.coordinator.begin("chat-1"), true);
  f.setActive(session(f.root, { sessionId: "replacement" }));
  assert.equal(await f.coordinator.begin("chat-1"), false);
  assert.equal(f.coordinator.isWaiting("chat-1"), true);
  assert.equal(f.coordinator.clearForCommand("chat-1", "/upload"), false);
  assert.equal(f.coordinator.isWaiting("chat-1"), true);
  assert.equal(f.coordinator.clearForCommand("chat-1", "/status"), true);
  assert.equal(f.coordinator.isWaiting("chat-1"), false);
  f.setActive(session(f.root));
  await f.coordinator.begin("chat-1");
  now += 300_000;
  assert.equal(f.coordinator.isWaiting("chat-1"), false);
  assert.equal(f.coordinator.cancel("chat-1"), false);
});

test("waiting text is suppressed with a reminder and does not consume pending state", async () => {
  const f = await fixture();
  await f.coordinator.begin("chat-1");
  const before = f.messages.length;
  assert.equal(await f.coordinator.handleWaitingText("chat-1"), true);
  assert.equal(f.messages.length, before + 1);
  assert.match(f.messages.at(-1) ?? "", /Document.*\/cancel/i);
  assert.equal(f.coordinator.isWaiting("chat-1"), true);
});

test("waiting text returns false without messaging when pending is absent or exactly expired", async () => {
  let now = 100;
  const f = await fixture({ now: () => now });
  assert.equal(await f.coordinator.handleWaitingText("chat-1"), false);
  assert.deepEqual(f.messages, []);
  await f.coordinator.begin("chat-1");
  const before = f.messages.length;
  now += 300_000;
  assert.equal(await f.coordinator.handleWaitingText("chat-1"), false);
  assert.equal(f.messages.length, before);
  assert.equal(f.coordinator.isWaiting("chat-1"), false);
});

test("waiting reminder send rejection leaves state intact and does not poison the chat queue", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-upload-waiting-reject-"));
  let rejectReminder = false;
  let reminders = 0;
  const coordinator = new UploadFileCoordinator({
    getActiveSession: () => session(root),
    hasConflictingInput: () => false,
    getApi: () => null,
    safeSendMessage: async (_chatId, text) => {
      if (/Waiting for one Telegram Document/u.test(text)) {
        reminders += 1;
        if (rejectReminder) throw new Error("send rejected");
      }
      return true;
    },
    logger: { warn: async () => {} }
  });
  await coordinator.begin("chat-1");
  rejectReminder = true;
  await assert.rejects(coordinator.handleWaitingText("chat-1"), /send rejected/);
  assert.equal(coordinator.isWaiting("chat-1"), true);
  rejectReminder = false;
  assert.equal(await coordinator.handleWaitingText("chat-1"), true);
  assert.equal(reminders, 2);
  assert.equal(coordinator.isWaiting("chat-1"), true);
});

test("concurrent begin calls serialize and preserve the original session binding", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-upload-begin-race-"));
  const messages: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let realpathCalls = 0;
  let active = session(root);
  const coordinator = new UploadFileCoordinator({
    getActiveSession: () => active,
    hasConflictingInput: () => false,
    getApi: () => null,
    safeSendMessage: async (_chatId, text) => { messages.push(text); return true; },
    logger: { warn: async () => {} },
    canonicalizeProjectRoot: async (path) => {
      realpathCalls += 1;
      if (realpathCalls === 1) await gate;
      return path;
    }
  });
  const first = coordinator.begin("chat-1");
  await new Promise((resolve) => setImmediate(resolve));
  active = session(root, { sessionId: "replacement" });
  const second = coordinator.begin("chat-1");
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(messages.filter((text) => /already waiting/i.test(text)).length, 1);
  active = session(root);
  assert.equal(await coordinator.handleDocument("chat-1", doc("original")), true);
});

test("a rejected per-chat queue operation does not poison its tail", async () => {
  const f = await fixture();
  let calls = 0;
  const coordinator = new UploadFileCoordinator({
    getActiveSession: () => {
      calls += 1;
      if (calls === 1) throw new Error("isolated failure");
      return session(f.root);
    },
    hasConflictingInput: () => false,
    getApi: () => null,
    safeSendMessage: async () => true,
    logger: { warn: async () => {} }
  });
  await assert.rejects(coordinator.begin("chat-1"), /isolated failure/);
  assert.equal(await coordinator.begin("chat-1"), true);
});

test("cancel and another command invalidate a begin that is awaiting filesystem work", async () => {
  for (const invalidate of [
    (coordinator: UploadFileCoordinator) => coordinator.cancel("chat-1"),
    (coordinator: UploadFileCoordinator) => coordinator.clearForCommand("chat-1", "/status")
  ]) {
    const f = await fixture();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const coordinator = new UploadFileCoordinator({
      getActiveSession: () => session(f.root),
      hasConflictingInput: () => false,
      getApi: () => null,
      safeSendMessage: async () => true,
      logger: { warn: async () => {} },
      canonicalizeProjectRoot: async (path) => { await gate; return path; }
    });
    const beginning = coordinator.begin("chat-1");
    await new Promise((resolve) => setImmediate(resolve));
    invalidate(coordinator);
    release();
    assert.equal(await beginning, false);
    assert.equal(coordinator.isWaiting("chat-1"), false);
  }
});

test("validates raw Telegram filenames, including safe dotfiles", async () => {
  const valid = await fixture();
  await valid.coordinator.begin("chat-1");
  assert.equal(await valid.coordinator.handleDocument("chat-1", doc(".env")), true);
  assert.deepEqual(await readFile(join(valid.root, ".env")), Buffer.from([0, 1, 2, 255]));

  for (const name of [
    undefined, "", ".", "..", "a/b", "a\\b", "a\0b", "a\rb", "a\nb", "/abs",
    "C:\\x", "\\\\server\\share", "../x", "a:b", "a<b", "a>b", "a\"b", "a|b", "a?b", "a*b"
  ]) {
    const f = await fixture();
    await f.coordinator.begin("chat-1");
    assert.equal(await f.coordinator.handleDocument("chat-1", doc(name)), true, String(name));
    assert.equal(f.coordinator.isWaiting("chat-1"), false);
  }
});

test("descriptor verification rejects a symlink swap without touching its external target", async () => {
  const f = await fixture();
  const external = join(f.root, "external-secret");
  await writeFile(external, "untouched", { mode: 0o644 });
  const coordinator = new UploadFileCoordinator({
    getActiveSession: () => session(f.root),
    hasConflictingInput: () => false,
    getApi: () => ({
      getFile: async (fileId) => ({ file_id: fileId, file_path: "opaque" }),
      downloadFile: async (_fileId, path) => { await writeFile(path, "download"); return path; }
    }),
    safeSendMessage: async () => true,
    logger: { warn: async () => {} },
    afterTempValidated: async (path) => { await rm(path); await symlink(external, path); }
  });
  await coordinator.begin("chat-1");
  assert.equal(await coordinator.handleDocument("chat-1", doc("destination")), true);
  assert.equal(await readFile(external, "utf8"), "untouched");
  if (process.platform !== "win32") assert.equal((await stat(external)).mode & 0o777, 0o644);
  await assert.rejects(lstat(join(f.root, "destination")), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
});

test("descriptor verification removes a destination linked from a swapped inode", async () => {
  const f = await fixture();
  const coordinator = new UploadFileCoordinator({
    getActiveSession: () => session(f.root),
    hasConflictingInput: () => false,
    getApi: () => ({
      getFile: async (fileId) => ({ file_id: fileId, file_path: "opaque" }),
      downloadFile: async (_fileId, path) => { await writeFile(path, "original"); return path; }
    }),
    safeSendMessage: async () => true,
    logger: { warn: async () => {} },
    afterTempValidated: async (path) => { await rm(path); await writeFile(path, "replacement"); }
  });
  await coordinator.begin("chat-1");
  assert.equal(await coordinator.handleDocument("chat-1", doc("destination")), true);
  await assert.rejects(lstat(join(f.root, "destination")), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
});

test("post-link destination replacement is reported without deleting or overwriting the racer's winner", async () => {
  const f = await fixture();
  const messages: string[] = [];
  const destination = join(f.root, "destination");
  const coordinator = new UploadFileCoordinator({
    getActiveSession: () => session(f.root),
    hasConflictingInput: () => false,
    getApi: () => ({
      getFile: async (fileId) => ({ file_id: fileId, file_path: "opaque" }),
      downloadFile: async (_fileId, path) => { await writeFile(path, "upload"); return path; }
    }),
    safeSendMessage: async (_chatId, text) => { messages.push(text); return true; },
    logger: { warn: async () => {} },
    afterDestinationLinked: async (path) => {
      await rm(path);
      await writeFile(path, "racer-wins", { flag: "wx" });
    }
  });
  await coordinator.begin("chat-1");
  assert.equal(await coordinator.handleDocument("chat-1", doc("destination")), true);
  assert.equal(destination, join(f.root, "destination"));
  assert.equal(await readFile(destination, "utf8"), "racer-wins");
  assert.match(messages.at(-1) ?? "", /could not be saved/i);
  assert.equal((await readFileNames(f.root)).some((name) => name.startsWith(".ctb-upload-")), false);
});

test("rejects declared and actual unsupported sizes without leaving state or temp files", async () => {
  const declared = await fixture();
  let downloaded = false;
  declared.setDownload(async () => { downloaded = true; return null; });
  await declared.coordinator.begin("chat-1");
  assert.equal(await declared.coordinator.handleDocument("chat-1", {
    ...doc("large"), file_size: MAX_UPLOAD_FILE_BYTES + 1
  }), true);
  assert.equal(downloaded, false);

  const actual = await fixture();
  actual.setDownload(async (_id, path) => {
    const handle = await open(path, "r+");
    await handle.truncate(MAX_UPLOAD_FILE_BYTES + 1);
    await handle.close();
    return path;
  });
  await actual.coordinator.begin("chat-1");
  assert.equal(await actual.coordinator.handleDocument("chat-1", doc("large")), true);
  assert.deepEqual(await readFileNames(actual.root), []);
});

test("streams byte-exact data with 0600 mode, no-clobber publication, and no sensitive output", async () => {
  const f = await fixture();
  await f.coordinator.begin("chat-1");
  assert.equal(await f.coordinator.handleDocument("chat-1", doc("credentials.env")), true);
  const saved = join(f.root, "credentials.env");
  assert.deepEqual(await readFile(saved), Buffer.from([0, 1, 2, 255]));
  if (process.platform !== "win32") assert.equal((await stat(saved)).mode & 0o777, 0o600);
  const serialized = JSON.stringify({ messages: f.messages, logs: f.logs });
  assert.doesNotMatch(serialized, /private-token|0,1,2,255|telegram-file-id/);
  assert.doesNotMatch(serialized, new RegExp(f.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const kind of ["file", "directory", "symlink"] as const) {
    const g = await fixture();
    const target = join(g.root, "exists");
    if (kind === "file") await writeFile(target, "original");
    if (kind === "directory") await mkdir(target);
    if (kind === "symlink") await symlink(join(g.root, "elsewhere"), target);
    await g.coordinator.begin("chat-1");
    assert.equal(await g.coordinator.handleDocument("chat-1", doc("exists")), true);
    assert.equal((await lstat(target)).isFile(), kind === "file");
    if (kind === "file") assert.equal(await readFile(target, "utf8"), "original");
    assert.equal((await readFileNames(g.root)).some((name) => name.startsWith(".ctb-upload-")), false);
  }

  const raced = await fixture();
  raced.setDownload(async (_id, path) => {
    await writeFile(path, "downloaded");
    await writeFile(join(raced.root, "raced"), "winner");
    return path;
  });
  await raced.coordinator.begin("chat-1");
  assert.equal(await raced.coordinator.handleDocument("chat-1", doc("raced")), true);
  assert.equal(await readFile(join(raced.root, "raced"), "utf8"), "winner");
  assert.equal((await readFileNames(raced.root)).some((name) => name.startsWith(".ctb-upload-")), false);
});

test("revalidates exact session and canonical root before download and publish, cleaning every temp path", async () => {
  const before = await fixture();
  await before.coordinator.begin("chat-1");
  before.setActive(session(before.root, { sessionId: "changed" }));
  assert.equal(await before.coordinator.handleDocument("chat-1", doc()), true);
  assert.equal((await readFileNames(before.root)).some((x) => x.startsWith(".ctb-upload-")), false);

  const during = await fixture();
  await during.coordinator.begin("chat-1");
  during.setDownload(async (_id, path) => {
    await writeFile(path, "sensitive");
    during.setActive(session(during.root, { projectPath: join(during.root, "other") }));
    return path;
  });
  assert.equal(await during.coordinator.handleDocument("chat-1", doc()), true);
  assert.deepEqual(await readFileNames(during.root), []);

  const failed = await fixture();
  await failed.coordinator.begin("chat-1");
  failed.setDownload(async () => { throw new Error("secret caption and https://api.telegram.org/botTOKEN/file"); });
  assert.equal(await failed.coordinator.handleDocument("chat-1", doc("safe.txt")), true);
  assert.deepEqual(await readFileNames(failed.root), []);
  assert.doesNotMatch(JSON.stringify(failed.logs), /secret caption|api\.telegram|TOKEN/);

  const wrongPath = await fixture();
  await wrongPath.coordinator.begin("chat-1");
  wrongPath.setDownload(async (_id, path) => {
    await writeFile(path, "sensitive");
    return join(wrongPath.root, "different-path");
  });
  assert.equal(await wrongPath.coordinator.handleDocument("chat-1", doc("never-published")), true);
  assert.deepEqual(await readFileNames(wrongPath.root), []);
});

test("download contract receives an absent UUID destination and publishes its returned path", async () => {
  const f = await fixture();
  f.setDownload(async (_id, path) => {
    await assert.rejects(lstat(path), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
    await writeFile(path, "contract bytes", { flag: "wx", mode: 0o600 });
    return path;
  });
  await f.coordinator.begin("chat-1");
  assert.equal(await f.coordinator.handleDocument("chat-1", doc("contract")), true);
  assert.equal(await readFile(join(f.root, "contract"), "utf8"), "contract bytes");
});

test("success notification rejection leaves the verified destination committed", async () => {
  const f = await fixture();
  let sends = 0;
  const logs: Array<Record<string, unknown> | undefined> = [];
  const coordinator = new UploadFileCoordinator({
    getActiveSession: () => session(f.root),
    hasConflictingInput: () => false,
    getApi: () => ({
      getFile: async (fileId) => ({ file_id: fileId, file_path: "opaque" }),
      downloadFile: async (_fileId, path) => { await writeFile(path, "committed"); return path; }
    }),
    safeSendMessage: async () => {
      sends += 1;
      if (sends === 2) throw new Error("notification contains secret URL");
      return true;
    },
    logger: { warn: async (_message, meta) => { logs.push(meta); } }
  });
  await coordinator.begin("chat-1");
  assert.equal(await coordinator.handleDocument("chat-1", doc("committed")), true);
  assert.equal(await readFile(join(f.root, "committed"), "utf8"), "committed");
  assert.doesNotMatch(JSON.stringify(logs), /secret URL/);
});

test("one document atomically claims pending state; queues isolate rejection and different chats", async () => {
  const f = await fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let downloads = 0;
  f.setDownload(async (_id, path) => { downloads += 1; await gate; await writeFile(path, "one"); return path; });
  await f.coordinator.begin("chat-1");
  const first = f.coordinator.handleDocument("chat-1", doc("first"));
  const second = f.coordinator.handleDocument("chat-1", doc("second"));
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(downloads, 1);

  const root2 = await mkdtemp(join(tmpdir(), "ctb-upload-chat2-"));
  f.setActive(session(root2, { chatId: "chat-2", telegramChatId: "chat-2", sessionId: "session-2" }));
  await f.coordinator.begin("chat-2");
  f.setDownload(async () => { throw new Error("fail"); });
  await f.coordinator.handleDocument("chat-2", doc("bad"));
  f.setActive(session(f.root));
  await f.coordinator.begin("chat-1");
  f.setDownload(async (_id, path) => { await writeFile(path, "ok"); return path; });
  assert.equal(await f.coordinator.handleDocument("chat-1", doc("good")), true);
});

test("startup cleanup removes only exact UUID temp regular files", async () => {
  const f = await fixture();
  const stale = ".ctb-upload-123e4567-e89b-42d3-a456-426614174000.tmp";
  const fresh = ".ctb-upload-123e4567-e89b-42d3-a456-426614174003.tmp";
  await writeFile(join(f.root, stale), "temp");
  await writeFile(join(f.root, fresh), "live");
  const staleTime = new Date(Date.now() - UPLOAD_TEMP_ABANDONMENT_MS - 1_000);
  await utimes(join(f.root, stale), staleTime, staleTime);
  await writeFile(join(f.root, ".ctb-upload-not-a-uuid.tmp"), "keep");
  await mkdir(join(f.root, ".ctb-upload-123e4567-e89b-42d3-a456-426614174001.tmp"));
  await symlink(join(f.root, "missing"), join(f.root, ".ctb-upload-123e4567-e89b-42d3-a456-426614174002.tmp"));
  await f.coordinator.cleanupStartup([f.root]);
  assert.deepEqual((await readFileNames(f.root)).sort(), [
    ".ctb-upload-123e4567-e89b-42d3-a456-426614174001.tmp",
    ".ctb-upload-123e4567-e89b-42d3-a456-426614174002.tmp",
    fresh,
    ".ctb-upload-not-a-uuid.tmp"
  ]);
});

async function readFileNames(root: string): Promise<string[]> {
  return await readdir(root);
}
