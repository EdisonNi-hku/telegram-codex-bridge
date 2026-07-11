import assert from "node:assert/strict";
import { chmod, lstat, mkdtemp, mkdir, open, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { TelegramDocument } from "../telegram/api.js";
import type { SessionRow } from "../types.js";
import { MAX_UPLOAD_FILE_BYTES, UploadFileCoordinator } from "./upload-file-coordinator.js";

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
  assert.match(f.coordinator.waitingText("chat-1"), /Document.*\/cancel/i);
  assert.equal(f.coordinator.clearForCommand("chat-1", "/upload"), false);
  assert.equal(f.coordinator.isWaiting("chat-1"), true);
  assert.equal(f.coordinator.clearForCommand("chat-1", "/status"), true);
  assert.equal(f.coordinator.isWaiting("chat-1"), false);
  f.setActive(session(f.root));
  await f.coordinator.begin("chat-1");
  now += 300_001;
  assert.equal(f.coordinator.isWaiting("chat-1"), false);
  assert.equal(f.coordinator.cancel("chat-1"), false);
});

test("validates raw Telegram filenames, including safe dotfiles", async () => {
  const valid = await fixture();
  await valid.coordinator.begin("chat-1");
  assert.equal(await valid.coordinator.handleDocument("chat-1", doc(".env")), true);
  assert.deepEqual(await readFile(join(valid.root, ".env")), Buffer.from([0, 1, 2, 255]));

  for (const name of [undefined, "", ".", "..", "a/b", "a\\b", "a\0b", "a\rb", "a\nb", "/abs", "C:\\x", "\\\\server\\share", "../x"]) {
    const f = await fixture();
    await f.coordinator.begin("chat-1");
    assert.equal(await f.coordinator.handleDocument("chat-1", doc(name)), true, String(name));
    assert.equal(f.coordinator.isWaiting("chat-1"), false);
  }
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
  const exact = ".ctb-upload-123e4567-e89b-42d3-a456-426614174000.tmp";
  await writeFile(join(f.root, exact), "temp");
  await writeFile(join(f.root, ".ctb-upload-not-a-uuid.tmp"), "keep");
  await mkdir(join(f.root, ".ctb-upload-123e4567-e89b-42d3-a456-426614174001.tmp"));
  await symlink(join(f.root, "missing"), join(f.root, ".ctb-upload-123e4567-e89b-42d3-a456-426614174002.tmp"));
  await f.coordinator.cleanupStartup([f.root]);
  assert.deepEqual((await readFileNames(f.root)).sort(), [
    ".ctb-upload-123e4567-e89b-42d3-a456-426614174001.tmp",
    ".ctb-upload-123e4567-e89b-42d3-a456-426614174002.tmp",
    ".ctb-upload-not-a-uuid.tmp"
  ]);
});

async function readFileNames(root: string): Promise<string[]> {
  return await readdir(root);
}
