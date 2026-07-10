import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { Logger } from "../logger.js";
import type { BridgePaths } from "../paths.js";
import { BridgeStateStore, StateStoreOpenError, readStateStoreFailure } from "./store.js";

const testLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {}
};

function createCapturingLogger() {
  const warnEntries: Array<{ message: string; meta?: unknown }> = [];
  const errorEntries: Array<{ message: string; meta?: unknown }> = [];

  const logger: Logger = {
    info: async () => {},
    warn: async (message: string, meta?: unknown) => {
      warnEntries.push({ message, meta });
    },
    error: async (message: string, meta?: unknown) => {
      errorEntries.push({ message, meta });
    }
  };

  return { logger, warnEntries, errorEntries };
}

function createTestPaths(root: string): BridgePaths {
  const logsDir = join(root, "logs");
  const telegramSessionFlowLogsDir = join(logsDir, "telegram-session-flow");
  const runtimeDir = join(root, "runtime");

  return {
    homeDir: root,
    repoRoot: root,
    installRoot: join(root, "install"),
    stateRoot: join(root, "state"),
    configRoot: join(root, "config"),
    logsDir,
    perfLogsDir: join(logsDir, "perf"),
    telegramSessionFlowLogsDir,
    runtimeDir,
    cacheDir: join(root, "cache"),
    dbPath: join(root, "state", "bridge.db"),
    stateStoreFailurePath: join(root, "state", "state-store-open-failure.json"),
    envPath: join(root, "config", "bridge.env"),
    servicePath: join(root, "service", "bridge.service"),
    launchAgentPath: join(root, "LaunchAgents", "bridge.plist"),
    binPath: join(root, "bin", "ctb"),
    manifestPath: join(root, "install", "install-manifest.json"),
    offsetPath: join(runtimeDir, "telegram-offset.json"),
    bridgeLogPath: join(logsDir, "bridge.log"),
    bootstrapLogPath: join(logsDir, "bootstrap.log"),
    appServerLogPath: join(logsDir, "app-server.log"),
    telegramStatusCardLogPath: join(telegramSessionFlowLogsDir, "status-card.log"),
    telegramPlanCardLogPath: join(telegramSessionFlowLogsDir, "plan-card.log"),
    telegramErrorCardLogPath: join(telegramSessionFlowLogsDir, "error-card.log")
  };
}

async function openStore(): Promise<{ paths: BridgePaths; store: BridgeStateStore; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "ctb-store-test-"));
  const paths = createTestPaths(root);
  await Promise.all([
    mkdir(paths.stateRoot, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.configRoot, { recursive: true })
  ]);

  const store = await BridgeStateStore.open(paths, testLogger);
  return {
    paths,
    store,
    cleanup: async () => {
      try {
        store.close();
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== "ERR_INVALID_STATE") {
          throw error;
        }
      }
      await rm(root, { recursive: true, force: true });
    }
  };
}

function authorizeTestChat(store: BridgeStateStore, chatId: string): void {
  store.upsertPendingAuthorization({ userId: `user-${chatId}`, chatId, username: null, displayName: null });
  const candidate = store.listPendingAuthorizations().find((row) => row.chatId === chatId);
  assert.ok(candidate);
  store.confirmPendingAuthorization(candidate);
}

async function seedLegacyStore(): Promise<{ paths: BridgePaths; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "ctb-store-legacy-test-"));
  const paths = createTestPaths(root);
  await Promise.all([
    mkdir(paths.stateRoot, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.configRoot, { recursive: true })
  ]);

  const db = new DatabaseSync(paths.dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE authorized_user (
      telegram_user_id TEXT PRIMARY KEY,
      telegram_username TEXT NULL,
      display_name TEXT NULL,
      first_seen_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE pending_authorization (
      telegram_user_id TEXT PRIMARY KEY,
      telegram_chat_id TEXT NOT NULL,
      telegram_username TEXT NULL,
      display_name TEXT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE chat_binding (
      telegram_chat_id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      active_session_id TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE session (
      session_id TEXT PRIMARY KEY,
      telegram_chat_id TEXT NOT NULL,
      thread_id TEXT NULL,
      display_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      project_path TEXT NOT NULL,
      status TEXT NOT NULL,
      failure_reason TEXT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      last_turn_id TEXT NULL,
      last_turn_status TEXT NULL
    );

    CREATE TABLE recent_project (
      project_path TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      last_session_id TEXT NULL,
      last_success_at TEXT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE project_scan_cache (
      project_path TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      scan_root TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      detected_markers TEXT NOT NULL,
      last_scanned_at TEXT NOT NULL,
      exists_now INTEGER NOT NULL
    );

    CREATE TABLE bootstrap_state (
      key TEXT PRIMARY KEY,
      readiness_state TEXT NOT NULL,
      details_json TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      app_server_pid TEXT NULL
    );

    CREATE TABLE runtime_notice (
      key TEXT PRIMARY KEY,
      telegram_chat_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.prepare(
    `
      INSERT INTO authorized_user (
        telegram_user_id,
        telegram_username,
        display_name,
        first_seen_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `
  ).run("user-legacy", "legacy", "Legacy User", "2026-03-10T10:00:00.000Z", "2026-03-10T10:00:00.000Z");

  db.prepare(
    `
      INSERT INTO chat_binding (
        telegram_chat_id,
        telegram_user_id,
        active_session_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `
  ).run("chat-legacy", "user-legacy", "session-legacy", "2026-03-10T10:00:00.000Z", "2026-03-10T10:00:00.000Z");

  db.prepare(
    `
      INSERT INTO session (
        session_id,
        telegram_chat_id,
        thread_id,
        display_name,
        project_name,
        project_path,
        status,
        failure_reason,
        created_at,
        last_used_at,
        last_turn_id,
        last_turn_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    "session-legacy",
    "chat-legacy",
    "thread-legacy",
    "Legacy Session",
    "Legacy Project",
    "/tmp/legacy-project",
    "idle",
    null,
    "2026-03-10T10:00:00.000Z",
    "2026-03-10T10:00:00.000Z",
    null,
    "completed"
  );

  db.close();

  return {
    paths,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    }
  };
}

async function createEmptyPaths(): Promise<{ paths: BridgePaths; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "ctb-store-empty-test-"));
  const paths = createTestPaths(root);
  await Promise.all([
    mkdir(paths.stateRoot, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.configRoot, { recursive: true })
  ]);

  return {
    paths,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    }
  };
}

test("confirmPendingAuthorization migrates sessions, active session, and notices to rebound chat", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-1",
      chatId: "chat-old",
      username: "old_name",
      displayName: "Old Name"
    });
    const [initialCandidate] = store.listPendingAuthorizations();
    assert.ok(initialCandidate);
    store.confirmPendingAuthorization(initialCandidate);

    const firstSession = store.createSession({
      chatId: "chat-old",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    const secondSession = store.createSession({
      chatId: "chat-old",
      projectName: "Project Two",
      projectPath: "/tmp/project-two"
    });
    store.setCommandPanelPreferences("chat-old", ["status", "model"]);
    store.setActiveSession("chat-old", firstSession.sessionId);
    store.updateSessionStatus(secondSession.sessionId, "running");
    store.markRunningSessionsFailedWithNotices("bridge_restart");

    store.upsertPendingAuthorization({
      userId: "user-1",
      chatId: "chat-new",
      username: "new_name",
      displayName: "New Name"
    });
    const [rebindCandidate] = store.listPendingAuthorizations();
    assert.ok(rebindCandidate);
    store.confirmPendingAuthorization(rebindCandidate);

    const newBinding = store.getChatBinding("chat-new");
    assert.ok(newBinding);
    assert.equal(newBinding.activeSessionId, firstSession.sessionId);
    assert.equal(store.getChatBinding("chat-old"), null);

    const reboundSessions = store.listSessions("chat-new", 10);
    assert.equal(reboundSessions.length, 2);
    assert.deepEqual(
      new Set(reboundSessions.map((session) => session.sessionId)),
      new Set([firstSession.sessionId, secondSession.sessionId])
    );
    assert.equal(store.listSessions("chat-old", 10).length, 0);

    const activeSession = store.getActiveSession("chat-new");
    assert.equal(activeSession?.sessionId, firstSession.sessionId);
    assert.deepEqual(store.getCommandPanelPreferences("chat-new")?.commands, ["status", "model"]);
    assert.equal(store.getCommandPanelPreferences("chat-old"), null);

    const notices = store.listRuntimeNotices("chat-new");
    assert.equal(notices.length, 1);
    assert.equal(notices[0]?.chatId, "chat-new");
    assert.equal(store.listRuntimeNotices("chat-old").length, 0);
    assert.equal(store.countRuntimeNotices(), 1);
  } finally {
    await cleanup();
  }
});

test("authorization rebind keeps the latest command panel preferences across old and new chats", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-command-panel-rebind",
      chatId: "chat-old-pref",
      username: "viewer_old",
      displayName: "Viewer Old"
    });
    const [initialCandidate] = store.listPendingAuthorizations();
    assert.ok(initialCandidate);
    store.confirmPendingAuthorization(initialCandidate);

    store.setCommandPanelPreferences("chat-old-pref", ["status", "skills"]);
    store.setCommandPanelPreferences("chat-new-pref", ["help", "model"]);
    ((store as any).db as { prepare: (sql: string) => { run: (...params: unknown[]) => void } })
      .prepare("UPDATE command_panel_preferences SET updated_at = ? WHERE chat_id = ?")
      .run("2026-04-10T00:00:02.000Z", "chat-old-pref");
    ((store as any).db as { prepare: (sql: string) => { run: (...params: unknown[]) => void } })
      .prepare("UPDATE command_panel_preferences SET updated_at = ? WHERE chat_id = ?")
      .run("2026-04-10T00:00:01.000Z", "chat-new-pref");

    store.upsertPendingAuthorization({
      userId: "user-command-panel-rebind",
      chatId: "chat-new-pref",
      username: "viewer_new",
      displayName: "Viewer New"
    });
    const [rebindCandidate] = store.listPendingAuthorizations();
    assert.ok(rebindCandidate);
    store.confirmPendingAuthorization(rebindCandidate);

    assert.deepEqual(store.getCommandPanelPreferences("chat-new-pref")?.commands, ["status", "skills"]);
    assert.equal(store.getCommandPanelPreferences("chat-old-pref"), null);
  } finally {
    await cleanup();
  }
});

test("open fails closed and writes a failure marker for obviously corrupt databases", async () => {
  const { paths, cleanup } = await createEmptyPaths();
  const { logger, errorEntries } = createCapturingLogger();

  try {
    await mkdir(paths.stateRoot, { recursive: true });
    await writeFile(paths.dbPath, "not a sqlite database", "utf8");

    await assert.rejects(
      () => BridgeStateStore.open(paths, logger),
      /state store open failed|file is not a database|sqlite/u
    );

    const marker = await readStateStoreFailure(paths);
    assert.ok(marker);
    assert.equal(marker?.classification, "integrity_failure");
    assert.equal(marker?.dbPath, paths.dbPath);
    const dbContent = await readFile(paths.dbPath, "utf8");
    assert.equal(dbContent, "not a sqlite database");
    assert.ok(errorEntries.some((entry) => entry.message === "state store open failed"));
  } finally {
    await cleanup();
  }
});

test("open writes a transient failure marker and does not rotate the database for transient integrity-check errors", async () => {
  const { paths, cleanup } = await createEmptyPaths();
  const { logger, errorEntries } = createCapturingLogger();
  const db = new DatabaseSync(paths.dbPath);
  db.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)");
  db.close();

  const originalPrepare = DatabaseSync.prototype.prepare;
  DatabaseSync.prototype.prepare = function patchedPrepare(sql: string) {
    if (sql === "PRAGMA integrity_check") {
      const error = new Error("database is locked");
      (error as NodeJS.ErrnoException).code = "ERR_SQLITE_ERROR";
      throw error;
    }
    return originalPrepare.call(this, sql);
  };

  try {
    await assert.rejects(
      () => BridgeStateStore.open(paths, logger),
      /database is locked/u
    );

    const files = await import("node:fs/promises").then(({ readdir }) => readdir(paths.stateRoot));
    assert.equal(files.some((name) => /^bridge\.db\.corrupt\./u.test(name)), false);
    const marker = await readStateStoreFailure(paths);
    assert.ok(marker);
    assert.equal(marker?.classification, "transient_open_failure");
    assert.ok(errorEntries.some((entry) => entry.message === "state store open failed"));
  } finally {
    DatabaseSync.prototype.prepare = originalPrepare;
    await cleanup();
  }
});

test("open writes a transient failure marker when ENOENT persists after the retry path", async () => {
  const { paths, cleanup } = await createEmptyPaths();
  const { logger } = createCapturingLogger();
  const originalOpenInitializedStore = (BridgeStateStore as any).openInitializedStore;
  const enoent = new Error("no such file or directory");
  (enoent as NodeJS.ErrnoException).code = "ENOENT";

  (BridgeStateStore as any).openInitializedStore = () => {
    throw enoent;
  };

  try {
    await assert.rejects(
      () => BridgeStateStore.open(paths, logger),
      (error: unknown) => {
        assert.ok(error instanceof StateStoreOpenError);
        assert.equal(error.failure.classification, "transient_open_failure");
        assert.equal(error.failure.stage, "open_db");
        return true;
      }
    );

    const marker = await readStateStoreFailure(paths);
    assert.ok(marker);
    assert.equal(marker?.classification, "transient_open_failure");
    assert.equal(marker?.stage, "open_db");
  } finally {
    (BridgeStateStore as any).openInitializedStore = originalOpenInitializedStore;
    await cleanup();
  }
});

test("open preserves the classified state-store error when writing the failure marker also fails", async () => {
  const { paths, cleanup } = await createEmptyPaths();
  const { logger, warnEntries } = createCapturingLogger();
  const originalOpenInitializedStore = (BridgeStateStore as any).openInitializedStore;
  const blockerPath = join(paths.stateRoot, "marker-parent-file");
  const enoent = new Error("no such file or directory");
  (enoent as NodeJS.ErrnoException).code = "ENOENT";

  (BridgeStateStore as any).openInitializedStore = () => {
    throw enoent;
  };

  try {
    await writeFile(blockerPath, "not a directory", "utf8");
    paths.stateStoreFailurePath = join(blockerPath, "failure.json");

    await assert.rejects(
      () => BridgeStateStore.open(paths, logger),
      (error: unknown) => {
        assert.ok(error instanceof StateStoreOpenError);
        assert.equal(error.failure.classification, "transient_open_failure");
        assert.equal(error.failure.stage, "open_db");
        assert.match(error.failure.error, /no such file or directory/u);
        return true;
      }
    );

    assert.ok(warnEntries.some((entry) => entry.message === "state store failure marker write failed"));
  } finally {
    (BridgeStateStore as any).openInitializedStore = originalOpenInitializedStore;
    await cleanup();
  }
});

test("open classifies malformed schema failures separately from integrity corruption", async () => {
  const { paths, cleanup } = await createEmptyPaths();
  const { logger } = createCapturingLogger();
  const db = new DatabaseSync(paths.dbPath);
  db.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)");
  db.close();

  const originalPrepare = DatabaseSync.prototype.prepare;
  DatabaseSync.prototype.prepare = function patchedPrepare(sql: string) {
    if (sql === "PRAGMA integrity_check") {
      throw new Error("malformed database schema (session)");
    }
    return originalPrepare.call(this, sql);
  };

  try {
    await assert.rejects(
      () => BridgeStateStore.open(paths, logger),
      (error: unknown) => {
        assert.ok(error instanceof StateStoreOpenError);
        assert.equal(error.failure.classification, "schema_failure");
        assert.equal(error.failure.stage, "verify_integrity");
        return true;
      }
    );

    const marker = await readStateStoreFailure(paths);
    assert.ok(marker);
    assert.equal(marker?.classification, "schema_failure");
  } finally {
    DatabaseSync.prototype.prepare = originalPrepare;
    await cleanup();
  }
});

test("open clears a stale state-store failure marker after a successful open", async () => {
  const { paths, cleanup } = await createEmptyPaths();

  try {
    await writeFile(paths.stateStoreFailurePath, JSON.stringify({
      detectedAt: "2026-03-14T08:00:00.000Z",
      dbPath: paths.dbPath,
      stage: "verify_integrity",
      classification: "transient_open_failure",
      error: "database is locked",
      recommendedAction: "retry"
    }, null, 2));

    const store = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.equal(await readStateStoreFailure(paths), null);
    } finally {
      store.close();
    }
  } finally {
    await cleanup();
  }
});

test("confirmPendingAuthorization keeps first-time authorization behavior unchanged", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-2",
      chatId: "chat-fresh",
      username: null,
      displayName: null
    });
    const [candidate] = store.listPendingAuthorizations();
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const binding = store.getChatBinding("chat-fresh");
    assert.ok(binding);
    assert.equal(binding.activeSessionId, null);
    assert.equal(store.listSessions("chat-fresh").length, 0);
    assert.equal(store.countRuntimeNotices(), 0);
  } finally {
    await cleanup();
  }
});

test("side sessions are active and persisted without appearing in regular history", async () => {
  const { store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-side");
    const parent = store.createSession({
      chatId: "chat-side",
      projectName: "Side Project",
      projectPath: "/tmp/side-project",
      selectedModel: "gpt-side",
      selectedReasoningEffort: "high",
      planMode: true
    });
    store.setActiveSession(parent.chatId, parent.sessionId);

    const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-side" });
    assert.equal(side.sessionKind, "side");
    assert.equal(side.parentSessionId, parent.sessionId);
    assert.equal(side.chatId, parent.chatId);
    assert.equal(side.projectPath, parent.projectPath);
    assert.equal(store.getActiveSession(parent.chatId)?.sessionId, side.sessionId);
    assert.deepEqual(store.listSessions(parent.chatId).map((row) => row.sessionId), [parent.sessionId]);
    assert.equal(store.listSessionsWithThreads().some((row) => row.sessionId === side.sessionId), false);
    assert.equal(store.getSideParent(side.sessionId)?.sessionId, parent.sessionId);
    assert.equal(store.getActiveSideForParent(parent.sessionId)?.sessionId, side.sessionId);

    const restored = store.restoreParentAndDeleteSide(side.sessionId);
    assert.equal(restored?.parent.sessionId, parent.sessionId);
    assert.equal(store.getSessionById(side.sessionId), null);
    assert.equal(store.getActiveSession(parent.chatId)?.sessionId, parent.sessionId);
  } finally {
    await cleanup();
  }
});

test("side session invariants reject invalid parents and history mutations", async () => {
  const { store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-side-negative");
    assert.throws(() => store.createSideSession({ parentSessionId: "missing", threadId: "thread" }), /parent/i);
    const parent = store.createSession({ chatId: "chat-side-negative", projectName: "P", projectPath: "/tmp/p" });
    const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-side-negative" });
    assert.throws(() => store.createSideSession({ parentSessionId: side.sessionId, threadId: "nested" }), /regular parent/i);
    store.setActiveSession(parent.chatId, parent.sessionId);
    assert.equal(store.getActiveSideForParent(parent.sessionId), null);
    assert.throws(() => store.createSideSession({ parentSessionId: parent.sessionId, threadId: "duplicate" }), /side session/i);
    assert.throws(() => store.archiveSession(side.sessionId), /side session/i);
    assert.throws(() => store.unarchiveSession(side.sessionId), /side session/i);
    assert.throws(() => store.renameSession(side.sessionId, "No"), /side session/i);
    assert.equal(store.autoRenameSession(side.sessionId, "No"), false);
    assert.throws(() => store.restoreParentAndDeleteSide(parent.sessionId), /side session/i);
  } finally {
    await cleanup();
  }
});

test("one stale open side blocks side creation for every parent in the same chat", async () => {
  const { store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-side-per-chat");
    const first = store.createSession({ chatId: "chat-side-per-chat", projectName: "First", projectPath: "/tmp/first" });
    const second = store.createSession({ chatId: "chat-side-per-chat", projectName: "Second", projectPath: "/tmp/second" });
    store.setActiveSession(first.chatId, first.sessionId);
    const staleSide = store.createSideSession({ parentSessionId: first.sessionId, threadId: "thread-first-side" });
    store.setActiveSession(first.chatId, second.sessionId);

    assert.throws(() => store.createSideSession({ parentSessionId: second.sessionId, threadId: "thread-second-side" }), /side session/i);
    assert.equal(store.getSessionById(staleSide.sessionId)?.sessionKind, "side");
  } finally {
    await cleanup();
  }
});

test("stale side restore returns null and preserves the side row", async () => {
  const { store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-side-stale-restore");
    const parent = store.createSession({ chatId: "chat-side-stale-restore", projectName: "Parent", projectPath: "/tmp/stale-parent" });
    const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-stale-restore" });
    store.setActiveSession(parent.chatId, parent.sessionId);

    assert.equal(store.restoreParentAndDeleteSide(side.sessionId), null);
    assert.equal(store.getSessionById(side.sessionId)?.sessionId, side.sessionId);
  } finally {
    await cleanup();
  }
});

test("orphaned active side atomically restores the most recent visible regular fallback", async () => {
  const { paths, store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-side-orphan-fallback");
    const parent = store.createSession({ chatId: "chat-side-orphan-fallback", projectName: "Parent", projectPath: "/tmp/orphan-parent" });
    const older = store.createSession({ chatId: parent.chatId, projectName: "Older", projectPath: "/tmp/older" });
    const newer = store.createSession({ chatId: parent.chatId, projectName: "Newer", projectPath: "/tmp/newer" });
    store.setActiveSession(parent.chatId, parent.sessionId);
    const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-orphan" });
    const raw = new DatabaseSync(paths.dbPath);
    raw.prepare("UPDATE session SET archived = 1 WHERE session_id = ?").run(parent.sessionId);
    raw.prepare("UPDATE session SET last_used_at = ? WHERE session_id = ?").run("2026-01-02T00:00:00.000Z", older.sessionId);
    raw.prepare("UPDATE session SET last_used_at = ? WHERE session_id = ?").run("2026-01-03T00:00:00.000Z", newer.sessionId);
    raw.close();

    const restored = store.restoreFallbackAndDeleteOrphanedSide(side.sessionId);
    assert.equal(restored?.fallback?.sessionId, newer.sessionId);
    assert.equal(store.getActiveSession(parent.chatId)?.sessionId, newer.sessionId);
    assert.equal(store.getSessionById(side.sessionId), null);
  } finally { await cleanup(); }
});

test("orphaned active side without fallback clears the binding for new-session state", async () => {
  const { paths, store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-side-orphan-new");
    const parent = store.createSession({ chatId: "chat-side-orphan-new", projectName: "Parent", projectPath: "/tmp/orphan-new" });
    const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-orphan-new" });
    const raw = new DatabaseSync(paths.dbPath);
    raw.prepare("UPDATE session SET archived = 1 WHERE session_id = ?").run(parent.sessionId); raw.close();

    const restored = store.restoreFallbackAndDeleteOrphanedSide(side.sessionId);
    assert.equal(restored?.fallback, null);
    assert.equal(store.getActiveSession(parent.chatId), null);
    assert.equal(store.getChatBinding(parent.chatId)?.activeSessionId, null);
    assert.equal(store.getSessionById(side.sessionId), null);
  } finally { await cleanup(); }
});

test("orphaned side fallback restore uses active-side CAS and makes no partial mutation", async () => {
  const { paths, store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-side-orphan-cas");
    const parent = store.createSession({ chatId: "chat-side-orphan-cas", projectName: "Parent", projectPath: "/tmp/orphan-cas" });
    const fallback = store.createSession({ chatId: parent.chatId, projectName: "Fallback", projectPath: "/tmp/fallback-cas" });
    store.setActiveSession(parent.chatId, parent.sessionId);
    const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-orphan-cas" });
    const raw = new DatabaseSync(paths.dbPath);
    raw.prepare("UPDATE session SET archived = 1 WHERE session_id = ?").run(parent.sessionId); raw.close();
    store.setActiveSession(parent.chatId, fallback.sessionId);

    assert.equal(store.restoreFallbackAndDeleteOrphanedSide(side.sessionId), null);
    assert.equal(store.getActiveSession(parent.chatId)?.sessionId, fallback.sessionId);
    assert.equal(store.getSessionById(side.sessionId)?.sessionId, side.sessionId);
  } finally { await cleanup(); }
});

test("createSideSession rejects empty and blank thread ids", async () => {
  const { store, cleanup } = await openStore();
  try {
    const parent = store.createSession({ chatId: "chat-side-thread", projectName: "Parent", projectPath: "/tmp/thread-parent" });
    assert.throws(() => store.createSideSession({ parentSessionId: parent.sessionId, threadId: "" }), /thread/i);
    assert.throws(() => store.createSideSession({ parentSessionId: parent.sessionId, threadId: "   \n" }), /thread/i);
  } finally {
    await cleanup();
  }
});

test("createSideSession rolls back when the parent chat has no binding", async () => {
  const { store, cleanup } = await openStore();
  try {
    const parent = store.createSession({ chatId: "chat-side-no-binding", projectName: "Parent", projectPath: "/tmp/no-binding-parent" });
    assert.throws(() => store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-no-binding" }), /binding/i);
    assert.deepEqual(store.listSideSessions(), []);
    assert.equal(store.getSessionById(parent.sessionId)?.sessionKind, "regular");
  } finally {
    await cleanup();
  }
});

test("open normalizes an active side pointer to the newest visible regular session", async () => {
  const { paths, store, cleanup } = await openStore();
  let reopened: BridgeStateStore | null = null;
  try {
    authorizeTestChat(store, "chat-side-normalize");
    const parent = store.createSession({ chatId: "chat-side-normalize", projectName: "Parent", projectPath: "/tmp/normalize-parent" });
    store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-side-normalize" });
    store.close();
    reopened = await BridgeStateStore.open(paths, testLogger);
    assert.equal(reopened.getActiveSession(parent.chatId)?.sessionId, parent.sessionId);
  } finally {
    reopened?.close();
    await cleanup();
  }
});

test("held terminal results are claimed once in creation order and mapped to pending", async () => {
  const { store, cleanup } = await openStore();
  try {
    for (const answerId of ["held-1", "held-2"]) {
      store.saveTerminalResultView({
        answerId,
        chatId: "chat-held",
        sessionId: "session-held",
        threadId: "thread-held",
        turnId: answerId,
        deliveryState: "held_for_side",
        previewHtml: answerId,
        pages: [answerId]
      });
    }
    assert.equal(store.countHeldTerminalResults("session-held"), 2);
    const claimed = store.claimHeldTerminalResults("session-held");
    assert.deepEqual(claimed.map((row) => row.answerId), ["held-1", "held-2"]);
    assert.ok(claimed.every((row) => row.deliveryState === "pending"));
    assert.equal(store.countHeldTerminalResults("session-held"), 0);
    assert.deepEqual(store.claimHeldTerminalResults("session-held"), []);
  } finally {
    await cleanup();
  }
});

test("held Side result parents become releasable only after their regular session is restored active", async () => {
  const { store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-held-recovery");
    const parent = store.createSession({
      chatId: "chat-held-recovery",
      projectName: "Parent",
      projectPath: "/tmp/held-recovery"
    });
    store.saveTerminalResultView({
      answerId: "held-recovery-answer",
      chatId: parent.chatId,
      sessionId: parent.sessionId,
      threadId: "thread-parent",
      turnId: "turn-parent",
      deliveryState: "held_for_side",
      previewHtml: "held",
      pages: ["held"]
    });
    store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-side" });

    assert.deepEqual(store.listHeldTerminalResultParentsReadyForRelease(), []);

    store.recoverSideSessionsAfterRestart();
    assert.deepEqual(store.listHeldTerminalResultParentsReadyForRelease(), [{
      chatId: parent.chatId,
      sessionId: parent.sessionId
    }]);
  } finally {
    await cleanup();
  }
});

test("two store connections claim each held terminal result exactly once", async () => {
  const { paths, store, cleanup } = await openStore();
  let second: BridgeStateStore | null = null;
  try {
    for (const answerId of ["shared-held-1", "shared-held-2"]) {
      store.saveTerminalResultView({
        answerId,
        chatId: "chat-shared-held",
        sessionId: "session-shared-held",
        threadId: "thread-shared-held",
        turnId: answerId,
        deliveryState: "held_for_side",
        previewHtml: answerId,
        pages: [answerId]
      });
    }
    second = await BridgeStateStore.open(paths, testLogger);
    const firstClaim = store.claimHeldTerminalResults("session-shared-held");
    const secondClaim = second.claimHeldTerminalResults("session-shared-held");
    assert.deepEqual(firstClaim.map((row) => row.answerId), ["shared-held-1", "shared-held-2"]);
    assert.deepEqual(secondClaim, []);
  } finally {
    second?.close();
    await cleanup();
  }
});

test("restart recovery deletes every corrupt side and emits one notice per side", async () => {
  const { paths, store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-multi-side-recovery");
    const parent = store.createSession({ chatId: "chat-multi-side-recovery", projectName: "Parent", projectPath: "/tmp/multi-parent" });
    const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-multi-1" });
    store.setActiveSession(parent.chatId, parent.sessionId);
    const db = new DatabaseSync(paths.dbPath);
    try {
      db.prepare(`
        INSERT INTO session (
          session_id, session_kind, parent_session_id, chat_id, telegram_chat_id, thread_id,
          selected_model, selected_reasoning_effort, plan_mode, pending_default_collaboration_mode_reset,
          display_name, display_name_source, project_name, project_path, status, failure_reason,
          archived, archived_at, created_at, last_used_at, last_turn_id, last_turn_status
        )
        SELECT
          'corrupt-side-2', 'side', 'missing-parent', chat_id, telegram_chat_id, 'thread-multi-2',
          selected_model, selected_reasoning_effort, plan_mode, pending_default_collaboration_mode_reset,
          'Corrupt Side', 'auto', project_name, project_path, 'idle', NULL,
          0, NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL, NULL
        FROM session WHERE session_id = ?
      `).run(parent.sessionId);
    } finally {
      db.close();
    }

    const recovered = store.recoverSideSessionsAfterRestart();
    assert.deepEqual(recovered.map((row) => row.sideSessionId), ["corrupt-side-2", side.sessionId]);
    assert.deepEqual(store.listSideSessions(), []);
    assert.equal(store.countRuntimeNotices(), 2);
    assert.equal(store.getActiveSession(parent.chatId)?.sessionId, parent.sessionId);
  } finally {
    await cleanup();
  }
});

test("restart side recovery restores a regular fallback, notices once, deletes sides, and is idempotent", async () => {
  const { store, cleanup } = await openStore();
  try {
    authorizeTestChat(store, "chat-side-recovery");
    const fallback = store.createSession({ chatId: "chat-side-recovery", projectName: "Fallback", projectPath: "/tmp/fallback" });
    const parent = store.createSession({ chatId: "chat-side-recovery", projectName: "Parent", projectPath: "/tmp/parent" });
    const side = store.createSideSession({ parentSessionId: parent.sessionId, threadId: "thread-recovery" });
    store.archiveSession(parent.sessionId);

    assert.deepEqual(store.recoverSideSessionsAfterRestart(), [{
      chatId: "chat-side-recovery",
      sideSessionId: side.sessionId,
      parentSessionId: parent.sessionId
    }]);
    assert.equal(store.getActiveSession("chat-side-recovery")?.sessionId, fallback.sessionId);
    assert.equal(store.getSessionById(side.sessionId), null);
    assert.equal(store.countRuntimeNotices(), 1);
    assert.deepEqual(store.recoverSideSessionsAfterRestart(), []);
    assert.equal(store.countRuntimeNotices(), 1);
  } finally {
    await cleanup();
  }
});

test("archiveSession hides archived sessions by default and reassigns the active session", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-archive",
      chatId: "chat-archive",
      username: "archiver",
      displayName: "Archiver"
    });
    const [candidate] = store.listPendingAuthorizations();
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const firstSession = store.createSession({
      chatId: "chat-archive",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    const secondSession = store.createSession({
      chatId: "chat-archive",
      projectName: "Project Two",
      projectPath: "/tmp/project-two"
    });

    store.setActiveSession("chat-archive", firstSession.sessionId);
    store.archiveSession(firstSession.sessionId);

    const visibleSessions = store.listSessions("chat-archive", { archived: false, limit: 10 });
    assert.equal(visibleSessions.length, 1);
    assert.equal(visibleSessions[0]?.sessionId, secondSession.sessionId);

    const archivedSessions = store.listSessions("chat-archive", { archived: true, limit: 10 });
    assert.equal(archivedSessions.length, 1);
    assert.equal(archivedSessions[0]?.sessionId, firstSession.sessionId);
    assert.equal(archivedSessions[0]?.archived, true);
    assert.ok(archivedSessions[0]?.archivedAt);
    assert.equal(archivedSessions[0]?.lastUsedAt, firstSession.lastUsedAt);

    const activeSession = store.getActiveSession("chat-archive");
    assert.equal(activeSession?.sessionId, secondSession.sessionId);
  } finally {
    await cleanup();
  }
});

test("unarchiveSession restores a session and makes it active when no active session remains", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-unarchive",
      chatId: "chat-unarchive",
      username: "restorer",
      displayName: "Restorer"
    });
    const [candidate] = store.listPendingAuthorizations();
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const session = store.createSession({
      chatId: "chat-unarchive",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });

    store.archiveSession(session.sessionId);
    assert.equal(store.getActiveSession("chat-unarchive"), null);

    store.unarchiveSession(session.sessionId);

    const visibleSessions = store.listSessions("chat-unarchive", { archived: false, limit: 10 });
    assert.equal(visibleSessions.length, 1);
    assert.equal(visibleSessions[0]?.sessionId, session.sessionId);
    assert.equal(visibleSessions[0]?.archived, false);
    assert.equal(visibleSessions[0]?.archivedAt, null);
    assert.equal(visibleSessions[0]?.lastUsedAt, session.lastUsedAt);

    const activeSession = store.getActiveSession("chat-unarchive");
    assert.equal(activeSession?.sessionId, session.sessionId);
  } finally {
    await cleanup();
  }
});

test("open migrates legacy session rows to include archive metadata", async () => {
  const { paths, cleanup } = await seedLegacyStore();

  let store: BridgeStateStore | null = null;

  try {
    store = await BridgeStateStore.open(paths, testLogger);
    const sessions = store.listSessions("chat-legacy", { archived: false, limit: 10 });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.sessionId, "session-legacy");
    assert.equal(sessions[0]?.archived, false);
    assert.equal(sessions[0]?.archivedAt, null);
    assert.equal(sessions[0]?.sessionKind, "regular");
    assert.equal(sessions[0]?.parentSessionId, null);

    const archivedSessions = store.listSessions("chat-legacy", { archived: true, limit: 10 });
    assert.equal(archivedSessions.length, 0);
  } finally {
    store?.close();
    await cleanup();
  }
});

test("archiveSession rejects running sessions even when called directly", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-running",
      chatId: "chat-running",
      username: "runner",
      displayName: "Runner"
    });
    const [candidate] = store.listPendingAuthorizations();
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const session = store.createSession({
      chatId: "chat-running",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionStatus(session.sessionId, "running");

    assert.throws(() => store.archiveSession(session.sessionId), /running session/i);
  } finally {
    await cleanup();
  }
});

test("open normalizes archived active-session pointers to the newest visible session", async () => {
  const { paths, store, cleanup } = await openStore();
  let reopenedStore: BridgeStateStore | null = null;

  try {
    store.upsertPendingAuthorization({
      userId: "user-normalize",
      chatId: "chat-normalize",
      username: "normalizer",
      displayName: "Normalizer"
    });
    const [candidate] = store.listPendingAuthorizations();
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const archivedSession = store.createSession({
      chatId: "chat-normalize",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    const visibleSession = store.createSession({
      chatId: "chat-normalize",
      projectName: "Project Two",
      projectPath: "/tmp/project-two"
    });

    store.archiveSession(archivedSession.sessionId);
    store.setActiveSession("chat-normalize", archivedSession.sessionId);
    store.close();

    reopenedStore = await BridgeStateStore.open(paths, testLogger);
    const activeSession = reopenedStore.getActiveSession("chat-normalize");
    assert.equal(activeSession?.sessionId, visibleSession.sessionId);
  } finally {
    reopenedStore?.close();
    await cleanup();
  }
});

test("getSessionByThreadId returns archived and visible sessions for diagnostics", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-thread-lookup",
      chatId: "chat-thread-lookup",
      username: "lookup",
      displayName: "Lookup"
    });
    const [candidate] = store.listPendingAuthorizations();
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const visibleSession = store.createSession({
      chatId: "chat-thread-lookup",
      projectName: "Visible Project",
      projectPath: "/tmp/visible-project"
    });
    store.updateSessionThreadId(visibleSession.sessionId, "thread-visible");

    const archivedSession = store.createSession({
      chatId: "chat-thread-lookup",
      projectName: "Archived Project",
      projectPath: "/tmp/archived-project"
    });
    store.updateSessionThreadId(archivedSession.sessionId, "thread-archived");
    store.archiveSession(archivedSession.sessionId);

    assert.equal(store.getSessionByThreadId("thread-visible")?.sessionId, visibleSession.sessionId);
    assert.equal(store.getSessionByThreadId("thread-archived")?.sessionId, archivedSession.sessionId);
    assert.equal(store.getSessionByThreadId("thread-missing"), null);
  } finally {
    await cleanup();
  }
});

test("session naming source defaults to auto and manual rename locks the session name", async () => {
  const { store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-title-source",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });

    assert.equal(store.getSessionById(session.sessionId)?.displayNameSource, "auto");

    store.autoRenameSession(session.sessionId, "Task: add title sync");
    assert.equal(store.getSessionById(session.sessionId)?.displayName, "Task: add title sync");
    assert.equal(store.getSessionById(session.sessionId)?.displayNameSource, "auto");

    store.renameSession(session.sessionId, "Manual Session Name");
    assert.equal(store.getSessionById(session.sessionId)?.displayName, "Manual Session Name");
    assert.equal(store.getSessionById(session.sessionId)?.displayNameSource, "manual");

    const updated = store.autoRenameSession(session.sessionId, "Task: should not override manual");
    assert.equal(updated, false);
    assert.equal(store.getSessionById(session.sessionId)?.displayName, "Manual Session Name");
    assert.equal(store.getSessionById(session.sessionId)?.displayNameSource, "manual");
  } finally {
    await cleanup();
  }
});

test("syncSessionTitleFromThread falls back to a cleaned preview when the thread name is missing", async () => {
  const { store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-title-preview",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      threadId: "thread-title-preview"
    });

    const updated = store.syncSessionTitleFromThread("thread-title-preview", {
      name: "   ",
      preview: "  :::   Fix runtime hub naming for multi-task sessions   \n\n "
    });

    assert.equal(updated, true);
    assert.equal(store.getSessionById(session.sessionId)?.displayName, "Fix runtime hub naming for multi-task sessions");
    assert.equal(store.getSessionById(session.sessionId)?.displayNameSource, "auto");
  } finally {
    await cleanup();
  }
});

test("saveTerminalResultView keeps only the 50 most recent answers per chat", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-final-answer-limit",
      chatId: "chat-final-answer-limit",
      username: "viewer",
      displayName: "Viewer"
    });
    const [candidate] = store.listPendingAuthorizations();
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const session = store.createSession({
      chatId: "chat-final-answer-limit",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-final-answer-limit");

    for (let index = 0; index < 55; index += 1) {
      store.saveTerminalResultView({
        answerId: `answer-${index}`,
        chatId: "chat-final-answer-limit",
        deliveryMessageId: 1000 + index,
        sessionId: session.sessionId,
        threadId: "thread-final-answer-limit",
        turnId: `turn-${index}`,
        previewHtml: `<b>Preview ${index}</b>`,
        pages: [`Page ${index}`]
      });
    }

    const views = store.listTerminalResultViews("chat-final-answer-limit");
    assert.equal(views.length, 50);
    assert.equal(views.at(0)?.answerId, "answer-54");
    assert.equal(views.at(-1)?.answerId, "answer-5");
    assert.equal(store.getTerminalResultView("answer-0", "chat-final-answer-limit"), null);
    assert.equal(store.getTerminalResultView("answer-54", "chat-final-answer-limit")?.deliveryMessageId, 1054);
  } finally {
    await cleanup();
  }
});

test("current session card records persist across reopen and can be removed", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    store.upsertCurrentSessionCard({
      chatId: "chat-card",
      messageId: 321,
      sessionId: "session-card"
    });

    const saved = store.getCurrentSessionCard("chat-card");
    assert.ok(saved);
    assert.equal(saved.chatId, "chat-card");
    assert.equal(saved.messageId, 321);
    assert.equal(saved.sessionId, "session-card");

    store.close();

    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      const restored = reopened.getCurrentSessionCard("chat-card");
      assert.ok(restored);
      assert.equal(restored.chatId, "chat-card");
      assert.equal(restored.messageId, 321);
      assert.equal(restored.sessionId, "session-card");

      reopened.deleteCurrentSessionCard("chat-card");
      assert.equal(reopened.getCurrentSessionCard("chat-card"), null);
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("open migrates legacy runtime artifact tables to neutral chat and message columns", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-store-migration17-test-"));
  const paths = createTestPaths(root);
  await Promise.all([
    mkdir(paths.stateRoot, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.configRoot, { recursive: true })
  ]);

  const db = new DatabaseSync(paths.dbPath);
  let store: BridgeStateStore | null = null;

  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE chat_binding (
        telegram_chat_id TEXT PRIMARY KEY,
        telegram_user_id TEXT NOT NULL,
        active_session_id TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE runtime_notice (
        key TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        parse_mode TEXT NULL,
        reply_markup_json TEXT NULL,
        session_id TEXT NULL,
        turn_id TEXT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE final_answer_view (
        answer_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        telegram_message_id INTEGER NULL,
        session_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'final_answer',
        delivery_state TEXT NOT NULL DEFAULT 'pending',
        preview_html TEXT NOT NULL,
        pages_json TEXT NOT NULL,
        primary_action_consumed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE current_session_card (
        telegram_chat_id TEXT PRIMARY KEY,
        telegram_message_id INTEGER NULL,
        session_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE pending_interaction (
        interaction_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        request_method TEXT NOT NULL,
        interaction_kind TEXT NOT NULL,
        state TEXT NOT NULL,
        prompt_json TEXT NOT NULL,
        response_json TEXT NULL,
        telegram_message_id INTEGER NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT NULL,
        error_reason TEXT NULL
      );
    `);

    for (let version = 1; version <= 16; version += 1) {
      db.prepare(
        `
          INSERT INTO schema_migrations (version, applied_at)
          VALUES (?, ?)
        `
      ).run(version, "2026-03-10T10:00:00.000Z");
    }

    db.prepare(
      `
        INSERT INTO runtime_notice (
          key,
          telegram_chat_id,
          type,
          message,
          parse_mode,
          reply_markup_json,
          session_id,
          turn_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run("notice-legacy", "chat-legacy", "app_server_notice", "legacy notice", null, null, "session-legacy", "turn-legacy", "2026-03-10T10:00:00.000Z");

    db.prepare(
      `
        INSERT INTO final_answer_view (
          answer_id,
          telegram_chat_id,
          telegram_message_id,
          session_id,
          thread_id,
          turn_id,
          kind,
          delivery_state,
          preview_html,
          pages_json,
          primary_action_consumed,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "answer-legacy",
      "chat-legacy",
      42,
      "session-legacy",
      "thread-legacy",
      "turn-legacy",
      "final_answer",
      "visible",
      "<b>Preview</b>",
      JSON.stringify(["<b>Page</b>"]),
      0,
      "2026-03-10T10:00:00.000Z"
    );

    db.prepare(
      `
        INSERT INTO current_session_card (
          telegram_chat_id,
          telegram_message_id,
          session_id,
          updated_at
        )
        VALUES (?, ?, ?, ?)
      `
    ).run("chat-legacy", 77, "session-legacy", "2026-03-10T10:00:00.000Z");

    db.prepare(
      `
        INSERT INTO pending_interaction (
          interaction_id,
          telegram_chat_id,
          session_id,
          thread_id,
          turn_id,
          request_id,
          request_method,
          interaction_kind,
          state,
          prompt_json,
          response_json,
          telegram_message_id,
          created_at,
          updated_at,
          resolved_at,
          error_reason
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "interaction-legacy",
      "chat-legacy",
      "session-legacy",
      "thread-legacy",
      "turn-legacy",
      "req-legacy",
      "item/tool/requestUserInput",
      "questionnaire",
      "pending",
      "{}",
      null,
      88,
      "2026-03-10T10:00:00.000Z",
      "2026-03-10T10:00:00.000Z",
      null,
      null
    );

    db.close();
    store = await BridgeStateStore.open(paths, testLogger);

    assert.equal(store.listRuntimeNotices("chat-legacy")[0]?.chatId, "chat-legacy");
    assert.equal(store.getFinalAnswerView("answer-legacy", "chat-legacy")?.deliveryMessageId, 42);
    assert.equal(store.getCurrentSessionCard("chat-legacy")?.messageId, 77);
    assert.equal(store.getPendingInteraction("interaction-legacy", "chat-legacy")?.messageId, 88);

    const verifyDb = new DatabaseSync(paths.dbPath);
    try {
      const runtimeNoticeColumns = verifyDb.prepare("PRAGMA table_info(runtime_notice)").all() as Array<{ name: string }>;
      const finalAnswerColumns = verifyDb.prepare("PRAGMA table_info(final_answer_view)").all() as Array<{ name: string }>;
      const currentSessionCardColumns = verifyDb.prepare("PRAGMA table_info(current_session_card)").all() as Array<{ name: string }>;
      const pendingInteractionColumns = verifyDb.prepare("PRAGMA table_info(pending_interaction)").all() as Array<{ name: string }>;

      assert.ok(runtimeNoticeColumns.some((column) => column.name === "chat_id"));
      assert.ok(finalAnswerColumns.some((column) => column.name === "chat_id"));
      assert.ok(finalAnswerColumns.some((column) => column.name === "delivery_message_id"));
      assert.ok(currentSessionCardColumns.some((column) => column.name === "chat_id"));
      assert.ok(currentSessionCardColumns.some((column) => column.name === "message_id"));
      assert.ok(pendingInteractionColumns.some((column) => column.name === "chat_id"));
      assert.ok(pendingInteractionColumns.some((column) => column.name === "message_id"));
    } finally {
      verifyDb.close();
    }
  } finally {
    try {
      store?.close();
    } catch {}
    try {
      db.close();
    } catch {}
    await rm(root, { recursive: true, force: true });
  }
});

test("open migrates legacy auth and session tables to neutral binding columns", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-store-migration18-test-"));
  const paths = createTestPaths(root);
  await Promise.all([
    mkdir(paths.stateRoot, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.configRoot, { recursive: true })
  ]);

  const db = new DatabaseSync(paths.dbPath);
  let store: BridgeStateStore | null = null;

  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE authorized_user (
        telegram_user_id TEXT PRIMARY KEY,
        telegram_username TEXT NULL,
        display_name TEXT NULL,
        first_seen_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE pending_authorization (
        telegram_user_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        telegram_username TEXT NULL,
        display_name TEXT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE chat_binding (
        telegram_chat_id TEXT PRIMARY KEY,
        telegram_user_id TEXT NOT NULL,
        active_session_id TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE session (
        session_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        thread_id TEXT NULL,
        selected_model TEXT NULL,
        selected_reasoning_effort TEXT NULL,
        plan_mode INTEGER NOT NULL DEFAULT 0,
        pending_default_collaboration_mode_reset INTEGER NOT NULL DEFAULT 0,
        display_name TEXT NOT NULL,
        display_name_source TEXT NOT NULL DEFAULT 'auto',
        project_name TEXT NOT NULL,
        project_path TEXT NOT NULL,
        status TEXT NOT NULL,
        failure_reason TEXT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        last_turn_id TEXT NULL,
        last_turn_status TEXT NULL
      );

      CREATE TABLE recent_project (
        project_path TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        project_alias TEXT NULL,
        last_used_at TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        last_session_id TEXT NULL,
        last_success_at TEXT NULL,
        source TEXT NOT NULL
      );
    `);

    for (let version = 1; version <= 17; version += 1) {
      db.prepare(
        `
          INSERT INTO schema_migrations (version, applied_at)
          VALUES (?, ?)
        `
      ).run(version, "2026-03-10T10:00:00.000Z");
    }

    db.prepare(
      `
        INSERT INTO authorized_user (
          telegram_user_id,
          telegram_username,
          display_name,
          first_seen_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `
    ).run("user-legacy", "legacy_user", "Legacy User", "2026-03-10T10:00:00.000Z", "2026-03-10T10:00:00.000Z");

    db.prepare(
      `
        INSERT INTO pending_authorization (
          telegram_user_id,
          telegram_chat_id,
          telegram_username,
          display_name,
          first_seen_at,
          last_seen_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run("user-pending", "chat-pending", "pending_user", "Pending User", "2026-03-10T10:00:00.000Z", "2026-03-10T10:05:00.000Z");

    db.prepare(
      `
        INSERT INTO chat_binding (
          telegram_chat_id,
          telegram_user_id,
          active_session_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `
    ).run("chat-legacy", "user-legacy", "session-legacy", "2026-03-10T10:00:00.000Z", "2026-03-10T10:00:00.000Z");

    db.prepare(
      `
        INSERT INTO session (
          session_id,
          telegram_chat_id,
          thread_id,
          selected_model,
          selected_reasoning_effort,
          plan_mode,
          pending_default_collaboration_mode_reset,
          display_name,
          display_name_source,
          project_name,
          project_path,
          status,
          failure_reason,
          archived,
          archived_at,
          created_at,
          last_used_at,
          last_turn_id,
          last_turn_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "session-legacy",
      "chat-legacy",
      "thread-legacy",
      null,
      null,
      0,
      0,
      "Legacy Session",
      "auto",
      "Legacy Project",
      "/tmp/legacy-project",
      "idle",
      null,
      0,
      null,
      "2026-03-10T10:00:00.000Z",
      "2026-03-10T10:00:00.000Z",
      null,
      null
    );

    db.close();
    store = await BridgeStateStore.open(paths, testLogger);

    const authorizedUser = store.getAuthorizedUser();
    assert.equal(authorizedUser?.platform, "telegram");
    assert.equal(authorizedUser?.userId, "user-legacy");
    assert.equal(authorizedUser?.username, "legacy_user");

    const [pendingAuthorization] = store.listPendingAuthorizations({ includeExpired: true });
    assert.equal(pendingAuthorization?.platform, "telegram");
    assert.equal(pendingAuthorization?.userId, "user-pending");
    assert.equal(pendingAuthorization?.chatId, "chat-pending");
    assert.equal(pendingAuthorization?.username, "pending_user");

    const binding = store.getChatBinding("chat-legacy");
    assert.equal(binding?.platform, "telegram");
    assert.equal(binding?.chatId, "chat-legacy");
    assert.equal(binding?.userId, "user-legacy");

    const session = store.getSessionById("session-legacy");
    assert.equal(session?.chatId, "chat-legacy");

    const verifyDb = new DatabaseSync(paths.dbPath);
    try {
      const authorizedUserColumns = verifyDb.prepare("PRAGMA table_info(authorized_user)").all() as Array<{ name: string }>;
      const pendingAuthorizationColumns = verifyDb.prepare("PRAGMA table_info(pending_authorization)").all() as Array<{ name: string }>;
      const chatBindingColumns = verifyDb.prepare("PRAGMA table_info(chat_binding)").all() as Array<{ name: string }>;
      const sessionColumns = verifyDb.prepare("PRAGMA table_info(session)").all() as Array<{ name: string }>;

      assert.ok(authorizedUserColumns.some((column) => column.name === "platform"));
      assert.ok(authorizedUserColumns.some((column) => column.name === "user_id"));
      assert.ok(authorizedUserColumns.some((column) => column.name === "username"));
      assert.ok(pendingAuthorizationColumns.some((column) => column.name === "platform"));
      assert.ok(pendingAuthorizationColumns.some((column) => column.name === "user_id"));
      assert.ok(pendingAuthorizationColumns.some((column) => column.name === "chat_id"));
      assert.ok(chatBindingColumns.some((column) => column.name === "platform"));
      assert.ok(chatBindingColumns.some((column) => column.name === "chat_id"));
      assert.ok(chatBindingColumns.some((column) => column.name === "user_id"));
      assert.ok(sessionColumns.some((column) => column.name === "chat_id"));
    } finally {
      verifyDb.close();
    }
  } finally {
    try {
      store?.close();
    } catch {}
    try {
      db.close();
    } catch {}
    await rm(root, { recursive: true, force: true });
  }
});

test("confirmPendingAuthorization migrates persisted final answers to the rebound chat", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-final-answer-rebind",
      chatId: "chat-old-final-answer",
      username: "viewer_old",
      displayName: "Viewer Old"
    });
    const [initialCandidate] = store.listPendingAuthorizations();
    assert.ok(initialCandidate);
    store.confirmPendingAuthorization(initialCandidate);

    const session = store.createSession({
      chatId: "chat-old-final-answer",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-final-answer-rebind");

    store.saveFinalAnswerView({
      answerId: "answer-rebind",
      chatId: "chat-old-final-answer",
      deliveryMessageId: 77,
      sessionId: session.sessionId,
      threadId: "thread-final-answer-rebind",
      turnId: "turn-final-answer-rebind",
      previewHtml: "<b>Preview</b>",
      pages: ["Page 1", "Page 2"]
    });

    store.upsertPendingAuthorization({
      userId: "user-final-answer-rebind",
      chatId: "chat-new-final-answer",
      username: "viewer_new",
      displayName: "Viewer New"
    });
    const [rebindCandidate] = store.listPendingAuthorizations();
    assert.ok(rebindCandidate);
    store.confirmPendingAuthorization(rebindCandidate);

    assert.equal(store.getFinalAnswerView("answer-rebind", "chat-old-final-answer"), null);
    const migrated = store.getFinalAnswerView("answer-rebind", "chat-new-final-answer");
    assert.ok(migrated);
    assert.equal(migrated?.chatId, "chat-new-final-answer");
    assert.equal(migrated?.deliveryMessageId, 77);
  } finally {
    await cleanup();
  }
});

test("clearAuthorization removes persisted final answers", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      userId: "user-final-answer-clear",
      chatId: "chat-final-answer-clear",
      username: "viewer",
      displayName: "Viewer"
    });
    const [candidate] = store.listPendingAuthorizations();
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const session = store.createSession({
      chatId: "chat-final-answer-clear",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-final-answer-clear");
    store.saveFinalAnswerView({
      answerId: "answer-clear",
      chatId: "chat-final-answer-clear",
      deliveryMessageId: 88,
      sessionId: session.sessionId,
      threadId: "thread-final-answer-clear",
      turnId: "turn-final-answer-clear",
      previewHtml: "<b>Preview</b>",
      pages: ["Page 1"]
    });

    store.clearAuthorization();

    assert.equal(store.listFinalAnswerViews("chat-final-answer-clear").length, 0);
    assert.equal(store.getFinalAnswerView("answer-clear", "chat-final-answer-clear"), null);
  } finally {
    await cleanup();
  }
});

test("open migrates legacy stores so pending interactions can be persisted", async () => {
  const { paths, cleanup } = await seedLegacyStore();

  try {
    const store = await BridgeStateStore.open(paths, testLogger);
    try {
      const saved = store.createPendingInteraction({
        chatId: "chat-legacy",
        sessionId: "session-legacy",
        threadId: "thread-legacy",
        turnId: "turn-legacy",
        requestId: 7,
        requestMethod: "item/commandExecution/requestApproval",
        interactionKind: "approval",
        promptJson: JSON.stringify({ kind: "approval", title: "Approval" })
      });

      assert.equal(saved.requestMethod, "item/commandExecution/requestApproval");
      assert.equal(store.listUnresolvedPendingInteractions().length, 1);
    } finally {
      store.close();
    }
  } finally {
    await cleanup();
  }
});

test("clearAuthorization can clear only the requested platform without touching the other pack", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      platform: "telegram",
      userId: "telegram-user",
      chatId: "telegram-chat",
      username: "tg",
      displayName: "Telegram User"
    });
    store.upsertPendingAuthorization({
      platform: "feishu",
      userId: "feishu-user",
      chatId: "feishu-chat",
      username: "fs",
      displayName: "Feishu User"
    });

    const telegramCandidate = store.listPendingAuthorizations({ platform: "telegram" })[0];
    const feishuCandidate = store.listPendingAuthorizations({ platform: "feishu" })[0];
    assert.ok(telegramCandidate);
    assert.ok(feishuCandidate);

    store.confirmPendingAuthorization(telegramCandidate);
    store.confirmPendingAuthorization(feishuCandidate);

    const telegramSession = store.createSession({
      chatId: "telegram-chat",
      projectName: "Telegram Project",
      projectPath: "/tmp/telegram-project"
    });
    const feishuSession = store.createSession({
      chatId: "feishu-chat",
      projectName: "Feishu Project",
      projectPath: "/tmp/feishu-project"
    });

    store.saveFinalAnswerView({
      answerId: "telegram-answer",
      chatId: "telegram-chat",
      sessionId: telegramSession.sessionId,
      threadId: "thread-telegram",
      turnId: "turn-telegram",
      previewHtml: "<b>Telegram</b>",
      pages: ["telegram"]
    });
    store.saveFinalAnswerView({
      answerId: "feishu-answer",
      chatId: "feishu-chat",
      sessionId: feishuSession.sessionId,
      threadId: "thread-feishu",
      turnId: "turn-feishu",
      previewHtml: "<b>Feishu</b>",
      pages: ["feishu"]
    });

    store.clearAuthorization("telegram");

    assert.equal(store.getAuthorizedUser("telegram"), null);
    assert.equal(store.getChatBinding("telegram-chat", "telegram"), null);
    assert.equal(store.listFinalAnswerViews("telegram-chat").length, 0);

    assert.equal(store.getAuthorizedUser("feishu")?.userId, "feishu-user");
    assert.equal(store.getChatBinding("feishu-chat", "feishu")?.userId, "feishu-user");
    assert.equal(store.listFinalAnswerViews("feishu-chat").length, 1);
  } finally {
    await cleanup();
  }
});

test("auth and binding rows allow the same user and chat identifiers on different platforms", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.upsertPendingAuthorization({
      platform: "telegram",
      userId: "shared-user",
      chatId: "shared-chat",
      username: "tg-user",
      displayName: "Telegram Shared"
    });
    store.upsertPendingAuthorization({
      platform: "feishu",
      userId: "shared-user",
      chatId: "shared-chat",
      username: "fs-user",
      displayName: "Feishu Shared"
    });

    const telegramCandidate = store.listPendingAuthorizations({ platform: "telegram" })[0];
    const feishuCandidate = store.listPendingAuthorizations({ platform: "feishu" })[0];
    assert.ok(telegramCandidate);
    assert.ok(feishuCandidate);

    store.confirmPendingAuthorization(telegramCandidate);
    store.confirmPendingAuthorization(feishuCandidate);

    assert.equal(store.getAuthorizedUser("telegram")?.userId, "shared-user");
    assert.equal(store.getAuthorizedUser("feishu")?.userId, "shared-user");
    assert.equal(store.getChatBinding("shared-chat", "telegram")?.userId, "shared-user");
    assert.equal(store.getChatBinding("shared-chat", "feishu")?.userId, "shared-user");
  } finally {
    await cleanup();
  }
});

test("authorization updates keep readiness state and pack state consistent", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.writeReadinessSnapshot({
      state: "awaiting_authorization",
      checkedAt: "2026-04-09T00:00:00.000Z",
      details: {
        activePack: "feishu",
        codexInstalled: true,
        codexAuthenticated: true,
        appServerAvailable: true,
        packState: "awaiting_authorization",
        authorizedUserBound: false,
        issues: ["feishu authorization is pending"],
        sharedIssues: [],
        packIssues: ["feishu authorization is pending"],
        packChecks: [{
          id: "feishu_authorization_binding",
          ok: false,
          summary: "feishu authorization is pending"
        }]
      }
    });

    store.upsertPendingAuthorization({
      platform: "feishu",
      userId: "feishu-user-ready",
      chatId: "feishu-chat-ready",
      username: "feishu",
      displayName: "Feishu Ready"
    });
    const candidate = store.listPendingAuthorizations({ platform: "feishu" })[0];
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const afterConfirm = store.getReadinessSnapshot();
    assert.equal(afterConfirm?.state, "ready");
    assert.equal(afterConfirm?.details.packState, "ready");
    assert.equal(afterConfirm?.details.setupState, "incomplete");
    assert.equal(afterConfirm?.details.authorizedUserBound, true);
    assert.match((afterConfirm?.details.packIssues ?? []).join("\n"), /text ingress has not been observed/u);
    assert.match((afterConfirm?.details.packIssues ?? []).join("\n"), /interactive card delivery has not been observed/u);
    assert.match((afterConfirm?.details.packIssues ?? []).join("\n"), /card callback has not been observed/u);

    store.clearAuthorization("feishu");

    const afterClear = store.getReadinessSnapshot();
    assert.equal(afterClear?.state, "awaiting_authorization");
    assert.equal(afterClear?.details.packState, "awaiting_authorization");
    assert.equal(afterClear?.details.setupState, "incomplete");
    assert.equal(afterClear?.details.authorizedUserBound, false);
    assert.match((afterClear?.details.packIssues ?? []).join("\n"), /feishu authorization is pending/u);
    assert.match((afterClear?.details.packIssues ?? []).join("\n"), /text ingress has not been observed/u);
  } finally {
    await cleanup();
  }
});

test("authorization transitions keep readiness snapshot pack fields consistent", async () => {
  const { store, cleanup } = await openStore();

  try {
    store.writeReadinessSnapshot({
      state: "awaiting_authorization",
      checkedAt: "2026-04-09T00:00:00.000Z",
      details: {
        activePack: "telegram",
        codexInstalled: true,
        codexAuthenticated: true,
        appServerAvailable: true,
        packState: "awaiting_authorization",
        authorizedUserBound: false,
        issues: ["telegram authorization is pending"],
        sharedIssues: [],
        packIssues: ["telegram authorization is pending"],
        packChecks: [{
          id: "telegram_authorization_binding",
          ok: false,
          summary: "telegram authorization is pending"
        }]
      }
    });

    store.upsertPendingAuthorization({
      platform: "telegram",
      userId: "user-ready",
      chatId: "chat-ready",
      username: "ready",
      displayName: "Ready"
    });
    const candidate = store.listPendingAuthorizations({ platform: "telegram" })[0];
    assert.ok(candidate);
    store.confirmPendingAuthorization(candidate);

    const afterConfirm = store.getReadinessSnapshot();
    assert.equal(afterConfirm?.state, "ready");
    assert.equal(afterConfirm?.details.packState, "ready");
    assert.equal(afterConfirm?.details.setupState, "complete");
    assert.equal(afterConfirm?.details.authorizedUserBound, true);
    assert.deepEqual(afterConfirm?.details.packIssues, []);
    assert.deepEqual(afterConfirm?.details.issues, []);
    assert.equal(afterConfirm?.details.packChecks?.[0]?.ok, true);
    assert.equal(afterConfirm?.details.packChecks?.[0]?.summary, "telegram authorization is bound");

    store.clearAuthorization("telegram");

    const afterClear = store.getReadinessSnapshot();
    assert.equal(afterClear?.state, "awaiting_authorization");
    assert.equal(afterClear?.details.packState, "awaiting_authorization");
    assert.equal(afterClear?.details.setupState, "complete");
    assert.equal(afterClear?.details.authorizedUserBound, false);
    assert.deepEqual(afterClear?.details.packIssues, ["telegram authorization is pending"]);
    assert.deepEqual(afterClear?.details.issues, ["telegram authorization is pending"]);
    assert.equal(afterClear?.details.packChecks?.[0]?.ok, false);
    assert.equal(afterClear?.details.packChecks?.[0]?.summary, "telegram authorization is pending");
  } finally {
    await cleanup();
  }
});

test("pending interactions persist lifecycle state and survive reopen", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-1");

    const created = store.createPendingInteraction({
      chatId: "chat-1",
      sessionId: session.sessionId,
      threadId: "thread-1",
      turnId: "turn-1",
      requestId: "server-1",
      requestMethod: "item/tool/requestUserInput",
      interactionKind: "questionnaire",
      promptJson: JSON.stringify({
        kind: "questionnaire",
        title: "Need answers",
        questions: [{ id: "environment" }]
      })
    });

    store.setPendingInteractionMessageId(created.interactionId, 7001);
    store.markPendingInteractionAwaitingText(
      created.interactionId,
      JSON.stringify({
        answers: {},
        awaitingQuestionId: "environment"
      })
    );

    const awaiting = store.getPendingInteraction(created.interactionId, "chat-1");
    assert.equal(awaiting?.messageId, 7001);
    assert.equal(awaiting?.state, "awaiting_text");

    store.markPendingInteractionPending(
      created.interactionId,
      JSON.stringify({
        answers: {
          environment: {
            answers: ["staging"]
          }
        }
      })
    );
    store.markPendingInteractionAnswered(
      created.interactionId,
      JSON.stringify({
        answers: {
          environment: {
            answers: ["staging"]
          }
        }
      })
    );

    const answered = store.getPendingInteraction(created.interactionId, "chat-1");
    assert.equal(answered?.state, "answered");
    assert.ok(answered?.resolvedAt);
    assert.equal(store.listPendingInteractionsByChat("chat-1", ["answered"]).length, 1);

    store.close();
    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      const reloaded = reopened.getPendingInteraction(created.interactionId, "chat-1");
      assert.equal(reloaded?.state, "answered");
      assert.equal(reloaded?.messageId, 7001);
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("pending interactions persist canceled terminal state and exclude it from unresolved listings", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-1");

    const created = store.createPendingInteraction({
      chatId: "chat-1",
      sessionId: session.sessionId,
      threadId: "thread-1",
      turnId: "turn-2",
      requestId: "server-cancel",
      requestMethod: "item/commandExecution/requestApproval",
      interactionKind: "approval",
      promptJson: JSON.stringify({
        kind: "approval",
        title: "Need approval"
      })
    });

    store.markPendingInteractionCanceled(
      created.interactionId,
      JSON.stringify({ decision: "cancel" }),
      "user_canceled_interaction"
    );

    const canceled = store.getPendingInteraction(created.interactionId, "chat-1");
    assert.equal(canceled?.state, "canceled");
    assert.equal(canceled?.errorReason, "user_canceled_interaction");
    assert.ok(canceled?.resolvedAt);
    assert.equal(store.listPendingInteractionsByChat("chat-1", ["canceled"]).length, 1);
    assert.equal(store.listUnresolvedPendingInteractions().length, 0);

    store.close();
    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      const reloaded = reopened.getPendingInteraction(created.interactionId, "chat-1");
      assert.equal(reloaded?.state, "canceled");
      assert.equal(reloaded?.errorReason, "user_canceled_interaction");
      assert.equal(reopened.listUnresolvedPendingInteractions().length, 0);
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("markPendingInteractionExpired persists expired terminal state", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-1");

    const created = store.createPendingInteraction({
      chatId: "chat-1",
      sessionId: session.sessionId,
      threadId: "thread-1",
      turnId: "turn-expired",
      requestId: "server-expired",
      requestMethod: "item/tool/requestUserInput",
      interactionKind: "questionnaire",
      promptJson: JSON.stringify({
        kind: "questionnaire",
        title: "Need answers"
      })
    });

    store.markPendingInteractionExpired(created.interactionId, "turn_completed");

    const expired = store.getPendingInteraction(created.interactionId, "chat-1");
    assert.equal(expired?.state, "expired");
    assert.equal(expired?.errorReason, "turn_completed");
    assert.ok(expired?.resolvedAt);

    store.close();
    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      const reloaded = reopened.getPendingInteraction(created.interactionId, "chat-1");
      assert.equal(reloaded?.state, "expired");
      assert.equal(reloaded?.errorReason, "turn_completed");
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("markRunningSessionsFailedWithNotices also fails unresolved pending interactions", async () => {
  const { store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-1");
    store.updateSessionStatus(session.sessionId, "running", {
      lastTurnId: "turn-1",
      lastTurnStatus: "running"
    });

    const interaction = store.createPendingInteraction({
      chatId: "chat-1",
      sessionId: session.sessionId,
      threadId: "thread-1",
      turnId: "turn-1",
      requestId: "server-2",
      requestMethod: "item/commandExecution/requestApproval",
      interactionKind: "approval",
      promptJson: JSON.stringify({ kind: "approval", title: "Approval" })
    });
    const canceled = store.createPendingInteraction({
      chatId: "chat-1",
      sessionId: session.sessionId,
      threadId: "thread-1",
      turnId: "turn-1",
      requestId: "server-3",
      requestMethod: "item/tool/requestUserInput",
      interactionKind: "questionnaire",
      promptJson: JSON.stringify({ kind: "questionnaire", title: "Questions" })
    });
    store.markPendingInteractionCanceled(canceled.interactionId, null, "user_canceled_interaction");

    store.markRunningSessionsFailedWithNotices("bridge_restart");

    const failed = store.getPendingInteraction(interaction.interactionId, "chat-1");
    assert.equal(failed?.state, "failed");
    assert.equal(failed?.errorReason, "bridge_restart");
    const stillCanceled = store.getPendingInteraction(canceled.interactionId, "chat-1");
    assert.equal(stillCanceled?.state, "canceled");
    assert.equal(stillCanceled?.errorReason, "user_canceled_interaction");
  } finally {
    await cleanup();
  }
});

test("selected model and reasoning effort persist on sessions and survive reopen", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-model",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      selectedModel: "gpt-5",
      selectedReasoningEffort: "medium"
    });

    assert.equal(store.getSessionById(session.sessionId)?.selectedModel, "gpt-5");
    assert.equal(store.getSessionById(session.sessionId)?.selectedReasoningEffort, "medium");

    store.setSessionSelectedModel(session.sessionId, "gpt-5-codex");
    store.setSessionSelectedReasoningEffort(session.sessionId, "high");
    assert.equal(store.getSessionById(session.sessionId)?.selectedModel, "gpt-5-codex");
    assert.equal(store.getSessionById(session.sessionId)?.selectedReasoningEffort, "high");

    store.close();
    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.equal(reopened.getSessionById(session.sessionId)?.selectedModel, "gpt-5-codex");
      assert.equal(reopened.getSessionById(session.sessionId)?.selectedReasoningEffort, "high");
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("session plan mode defaults off, updates, and survives reopen", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-plan-mode",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });

    assert.equal((store.getSessionById(session.sessionId) as any)?.planMode, false);
    assert.equal((store.getSessionById(session.sessionId) as any)?.needsDefaultCollaborationModeReset, false);

    (store as any).setSessionPlanMode(session.sessionId, true);
    assert.equal((store.getSessionById(session.sessionId) as any)?.planMode, true);
    assert.equal((store.getSessionById(session.sessionId) as any)?.needsDefaultCollaborationModeReset, false);

    (store as any).setSessionPlanMode(session.sessionId, false);
    assert.equal((store.getSessionById(session.sessionId) as any)?.planMode, false);
    assert.equal((store.getSessionById(session.sessionId) as any)?.needsDefaultCollaborationModeReset, true);

    store.close();
    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.equal((reopened.getSessionById(session.sessionId) as any)?.planMode, false);
      assert.equal((reopened.getSessionById(session.sessionId) as any)?.needsDefaultCollaborationModeReset, true);
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("runtime card preferences default to no optional fields", async () => {
  const { store, cleanup } = await openStore();

  try {
    assert.deepEqual(store.getRuntimeCardPreferences().fields, []);
  } finally {
    await cleanup();
  }
});

test("createSession persists seeded thread and last-turn metadata", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-seeded-session",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      threadId: "thread-seeded",
      lastTurnId: "turn-seeded",
      lastTurnStatus: "completed"
    });

    assert.equal(store.getSessionById(session.sessionId)?.threadId, "thread-seeded");
    assert.equal(store.getSessionById(session.sessionId)?.lastTurnId, "turn-seeded");
    assert.equal(store.getSessionById(session.sessionId)?.lastTurnStatus, "completed");

    store.close();
    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.equal(reopened.getSessionById(session.sessionId)?.threadId, "thread-seeded");
      assert.equal(reopened.getSessionById(session.sessionId)?.lastTurnId, "turn-seeded");
      assert.equal(reopened.getSessionById(session.sessionId)?.lastTurnStatus, "completed");
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("project aliases persist on recent projects and are exposed on session lookups", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-project-alias",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });

    store.setProjectAlias({
      projectPath: session.projectPath,
      projectName: session.projectName,
      projectAlias: "Alias One",
      sessionId: session.sessionId
    });

    assert.equal(store.getRecentProjectByPath(session.projectPath)?.projectAlias, "Alias One");
    assert.equal(store.getSessionById(session.sessionId)?.projectAlias, "Alias One");
    assert.equal(store.listSessions("chat-project-alias")[0]?.projectAlias, "Alias One");

    store.clearProjectAlias(session.projectPath);
    assert.equal(store.getSessionById(session.sessionId)?.projectAlias, null);

    store.setProjectAlias({
      projectPath: session.projectPath,
      projectName: session.projectName,
      projectAlias: "Alias Two",
      sessionId: session.sessionId
    });

    store.close();
    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.equal(reopened.getRecentProjectByPath(session.projectPath)?.projectAlias, "Alias Two");
      assert.equal(reopened.getSessionById(session.sessionId)?.projectAlias, "Alias Two");
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("open migrates legacy session rows to include selected model column", async () => {
  const { paths, cleanup } = await seedLegacyStore();
  let store: BridgeStateStore | null = null;

  try {
    store = await BridgeStateStore.open(paths, testLogger);
    assert.equal(store.getSessionById("session-legacy")?.selectedModel, null);

    store.setSessionSelectedModel("session-legacy", "gpt-5");
    assert.equal(store.getSessionById("session-legacy")?.selectedModel, "gpt-5");
  } finally {
    store?.close();
    await cleanup();
  }
});

test("open migrates legacy recent projects to include project aliases", async () => {
  const { paths, cleanup } = await seedLegacyStore();
  let store: BridgeStateStore | null = null;

  try {
    store = await BridgeStateStore.open(paths, testLogger);
    assert.equal(store.getRecentProjectByPath("/tmp/legacy-project"), null);

    store.setProjectAlias({
      projectPath: "/tmp/legacy-project",
      projectName: "Legacy Project",
      projectAlias: "Legacy Alias",
      sessionId: "session-legacy"
    });
    assert.equal(store.getSessionById("session-legacy")?.projectAlias, "Legacy Alias");
  } finally {
    store?.close();
    await cleanup();
  }
});

test("migration keeps legacy project-name session titles auto even when project alias exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-store-migration16-test-"));
  const paths = createTestPaths(root);
  await Promise.all([
    mkdir(paths.stateRoot, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.configRoot, { recursive: true })
  ]);
  const db = new DatabaseSync(paths.dbPath);
  let store: BridgeStateStore | null = null;

  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE authorized_user (
        telegram_user_id TEXT PRIMARY KEY,
        telegram_username TEXT NULL,
        display_name TEXT NULL,
        first_seen_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE pending_authorization (
        telegram_user_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        telegram_username TEXT NULL,
        display_name TEXT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE chat_binding (
        telegram_chat_id TEXT PRIMARY KEY,
        telegram_user_id TEXT NOT NULL,
        active_session_id TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE session (
        session_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        thread_id TEXT NULL,
        selected_model TEXT NULL,
        selected_reasoning_effort TEXT NULL,
        plan_mode INTEGER NOT NULL DEFAULT 0,
        pending_default_collaboration_mode_reset INTEGER NOT NULL DEFAULT 0,
        display_name TEXT NOT NULL,
        project_name TEXT NOT NULL,
        project_path TEXT NOT NULL,
        status TEXT NOT NULL,
        failure_reason TEXT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        last_turn_id TEXT NULL,
        last_turn_status TEXT NULL
      );

      CREATE TABLE recent_project (
        project_path TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        project_alias TEXT NULL,
        last_used_at TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        last_session_id TEXT NULL,
        last_success_at TEXT NULL,
        source TEXT NOT NULL
      );

      CREATE TABLE project_scan_cache (
        project_path TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        scan_root TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        detected_markers TEXT NOT NULL,
        last_scanned_at TEXT NOT NULL,
        exists_now INTEGER NOT NULL
      );

      CREATE TABLE bootstrap_state (
        key TEXT PRIMARY KEY,
        readiness_state TEXT NOT NULL,
        details_json TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        app_server_pid TEXT NULL
      );

      CREATE TABLE runtime_notice (
        key TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        parse_mode TEXT NULL,
        reply_markup_json TEXT NULL,
        session_id TEXT NULL,
        turn_id TEXT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE final_answer_view (
        answer_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        telegram_message_id INTEGER NULL,
        session_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'final_answer',
        delivery_state TEXT NOT NULL DEFAULT 'pending',
        preview_html TEXT NOT NULL,
        pages_json TEXT NOT NULL,
        primary_action_consumed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE runtime_card_preferences (
        key TEXT PRIMARY KEY,
        fields_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE bridge_settings (
        key TEXT PRIMARY KEY,
        ui_language TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE pending_interaction (
        interaction_id TEXT PRIMARY KEY,
        telegram_chat_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        request_method TEXT NOT NULL,
        interaction_kind TEXT NOT NULL,
        state TEXT NOT NULL,
        prompt_json TEXT NOT NULL,
        response_json TEXT NULL,
        telegram_message_id INTEGER NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT NULL,
        error_reason TEXT NULL
      );

      CREATE TABLE turn_input_source (
        thread_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        transcript TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (thread_id, turn_id)
      );
    `);

    for (let version = 1; version <= 15; version += 1) {
      db.prepare(
        `
          INSERT INTO schema_migrations (version, applied_at)
          VALUES (?, ?)
        `
      ).run(version, "2026-03-10T10:00:00.000Z");
    }

    db.prepare(
      `
        INSERT INTO session (
          session_id,
          telegram_chat_id,
          thread_id,
          selected_model,
          selected_reasoning_effort,
          plan_mode,
          pending_default_collaboration_mode_reset,
          display_name,
          project_name,
          project_path,
          status,
          failure_reason,
          archived,
          archived_at,
          created_at,
          last_used_at,
          last_turn_id,
          last_turn_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "session-legacy-alias",
      "chat-legacy-alias",
      "thread-legacy-alias",
      null,
      null,
      0,
      0,
      "Legacy Project",
      "Legacy Project",
      "/tmp/legacy-alias-project",
      "idle",
      null,
      0,
      null,
      "2026-03-10T10:00:00.000Z",
      "2026-03-10T10:00:00.000Z",
      null,
      null
    );

    db.prepare(
      `
        INSERT INTO session (
          session_id,
          telegram_chat_id,
          thread_id,
          selected_model,
          selected_reasoning_effort,
          plan_mode,
          pending_default_collaboration_mode_reset,
          display_name,
          project_name,
          project_path,
          status,
          failure_reason,
          archived,
          archived_at,
          created_at,
          last_used_at,
          last_turn_id,
          last_turn_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "session-legacy-fork",
      "chat-legacy-fork",
      "thread-legacy-fork",
      null,
      null,
      0,
      0,
      "Fork: Legacy Project",
      "Legacy Project",
      "/tmp/legacy-fork-project",
      "idle",
      null,
      0,
      null,
      "2026-03-10T10:00:00.000Z",
      "2026-03-10T10:00:00.000Z",
      null,
      null
    );

    db.prepare(
      `
        INSERT INTO recent_project (
          project_path,
          project_name,
          project_alias,
          last_used_at,
          pinned,
          last_session_id,
          last_success_at,
          source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "/tmp/legacy-alias-project",
      "Legacy Project",
      "Aliased Name",
      "2026-03-10T10:00:00.000Z",
      0,
      "session-legacy-alias",
      null,
      "mru"
    );

    db.prepare(
      `
        INSERT INTO recent_project (
          project_path,
          project_name,
          project_alias,
          last_used_at,
          pinned,
          last_session_id,
          last_success_at,
          source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "/tmp/legacy-fork-project",
      "Legacy Project",
      "Aliased Fork Project",
      "2026-03-10T10:00:00.000Z",
      0,
      "session-legacy-fork",
      null,
      "mru"
    );

    db.close();

    store = await BridgeStateStore.open(paths, testLogger);
    assert.equal(store.getSessionById("session-legacy-alias")?.displayNameSource, "auto");
    assert.equal(store.getSessionById("session-legacy-fork")?.displayNameSource, "auto");
  } finally {
    store?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("listPendingInteractionsByRequest matches compatible legacy and canonical request ids while excluding resolved rows", async () => {
  const { store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-request-id",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-request-id");

    const pending = store.createPendingInteraction({
      chatId: "chat-request-id",
      sessionId: session.sessionId,
      threadId: "thread-request-id",
      turnId: "turn-1",
      requestId: "server-1",
      requestMethod: "item/commandExecution/requestApproval",
      interactionKind: "approval",
      promptJson: JSON.stringify({ kind: "approval", title: "Need approval" })
    });
    const legacyPending = store.createPendingInteraction({
      chatId: "chat-request-id",
      sessionId: session.sessionId,
      threadId: "thread-request-id",
      turnId: "turn-1",
      requestId: "server-1",
      requestMethod: "item/tool/requestUserInput",
      interactionKind: "questionnaire",
      promptJson: JSON.stringify({ kind: "questionnaire", title: "Legacy request" })
    });
    const awaitingText = store.createPendingInteraction({
      chatId: "chat-request-id",
      sessionId: session.sessionId,
      threadId: "thread-request-id",
      turnId: "turn-1",
      requestId: "server-1",
      requestMethod: "item/tool/requestUserInput",
      interactionKind: "questionnaire",
      promptJson: JSON.stringify({ kind: "questionnaire", title: "Need input" })
    });
    const answered = store.createPendingInteraction({
      chatId: "chat-request-id",
      sessionId: session.sessionId,
      threadId: "thread-request-id",
      turnId: "turn-1",
      requestId: "server-1",
      requestMethod: "item/tool/requestUserInput",
      interactionKind: "questionnaire",
      promptJson: JSON.stringify({ kind: "questionnaire", title: "Answered" })
    });
    const otherRequest = store.createPendingInteraction({
      chatId: "chat-request-id",
      sessionId: session.sessionId,
      threadId: "thread-request-id",
      turnId: "turn-1",
      requestId: "server-2",
      requestMethod: "item/tool/requestUserInput",
      interactionKind: "questionnaire",
      promptJson: JSON.stringify({ kind: "questionnaire", title: "Other request" })
    });

    store.markPendingInteractionAwaitingText(awaitingText.interactionId, JSON.stringify({ awaitingQuestionId: "q1" }));
    store.markPendingInteractionAnswered(answered.interactionId, JSON.stringify({ decision: "accept" }));

    const matching = store.listPendingInteractionsByRequest("thread-request-id", "server-1");
    assert.deepEqual(
      matching.map((row) => row.interactionId).sort(),
      [awaitingText.interactionId, legacyPending.interactionId, pending.interactionId].sort()
    );
    assert.equal(matching.some((row) => row.interactionId === answered.interactionId), false);
    assert.equal(matching.some((row) => row.interactionId === otherRequest.interactionId), false);
  } finally {
    await cleanup();
  }
});

test("listPendingInteractionsByRequest keeps numeric-looking string ids distinct from numeric ids", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-request-id-numeric",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-request-id-numeric");

    const stringRequest = store.createPendingInteraction({
      chatId: "chat-request-id-numeric",
      sessionId: session.sessionId,
      threadId: "thread-request-id-numeric",
      turnId: "turn-1",
      requestId: "7",
      requestMethod: "item/commandExecution/requestApproval",
      interactionKind: "approval",
      promptJson: JSON.stringify({ kind: "approval", title: "String request" })
    });
    const numericRequest = store.createPendingInteraction({
      chatId: "chat-request-id-numeric",
      sessionId: session.sessionId,
      threadId: "thread-request-id-numeric",
      turnId: "turn-1",
      requestId: 7,
      requestMethod: "item/tool/requestUserInput",
      interactionKind: "questionnaire",
      promptJson: JSON.stringify({ kind: "questionnaire", title: "Numeric request" })
    });

    const timestamp = "2026-04-08T00:00:00.000Z";
    ((store as unknown as { db: import("node:sqlite").DatabaseSync }).db)
      .prepare(
        `
          INSERT INTO pending_interaction (
            interaction_id,
            chat_id,
            session_id,
            thread_id,
            turn_id,
            request_id,
            request_id_canonical,
            request_id_legacy,
            request_id_kind,
            request_method,
            interaction_kind,
            state,
            prompt_json,
            response_json,
            message_id,
            created_at,
            updated_at,
            resolved_at,
            error_reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL)
        `
      )
      .run(
        "legacy-string-request-id",
        "chat-request-id-numeric",
        session.sessionId,
        "thread-request-id-numeric",
        "turn-1",
        "7",
        "\"7\"",
        "7",
        "string",
        "item/commandExecution/requestApproval",
        "approval",
        "pending",
        JSON.stringify({ kind: "approval", title: "Legacy string request" }),
        timestamp,
        timestamp
      );

    assert.deepEqual(
      store.listPendingInteractionsByRequest("thread-request-id-numeric", "7").map((row) => row.interactionId).sort(),
      ["legacy-string-request-id", stringRequest.interactionId].sort()
    );
    assert.deepEqual(
      store.listPendingInteractionsByRequest("thread-request-id-numeric", 7).map((row) => row.interactionId),
      [numericRequest.interactionId]
    );

    store.close();
    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.deepEqual(
        reopened.listPendingInteractionsByRequest("thread-request-id-numeric", "7").map((row) => row.interactionId).sort(),
        ["legacy-string-request-id", stringRequest.interactionId].sort()
      );
      assert.deepEqual(
        reopened.listPendingInteractionsByRequest("thread-request-id-numeric", 7).map((row) => row.interactionId),
        [numericRequest.interactionId]
      );
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("open migrates runtime and interaction artifacts off Telegram mirror columns and preserves data after reopen", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    const session = store.createSession({
      chatId: "chat-mirror-cleanup",
      projectName: "Project One",
      projectPath: "/tmp/project-one"
    });
    store.updateSessionThreadId(session.sessionId, "thread-mirror-cleanup");
    store.createRuntimeNotice({
      key: "notice-mirror-cleanup",
      chatId: "chat-mirror-cleanup",
      type: "app_server_notice",
      message: "mirror cleanup"
    });
    store.upsertCurrentSessionCard({
      chatId: "chat-mirror-cleanup",
      messageId: 77,
      sessionId: session.sessionId
    });
    store.saveTerminalResultView({
      answerId: "answer-mirror-cleanup",
      chatId: "chat-mirror-cleanup",
      deliveryMessageId: 88,
      sessionId: session.sessionId,
      threadId: "thread-mirror-cleanup",
      turnId: "turn-mirror-cleanup",
      previewHtml: "<b>Preview</b>",
      pages: ["Page 1"]
    });
    store.createPendingInteraction({
      interactionId: "interaction-mirror-cleanup",
      chatId: "chat-mirror-cleanup",
      sessionId: session.sessionId,
      threadId: "thread-mirror-cleanup",
      turnId: "turn-mirror-cleanup",
      requestId: "mirror-cleanup",
      requestMethod: "item/commandExecution/requestApproval",
      interactionKind: "approval",
      promptJson: JSON.stringify({ kind: "approval", title: "Cleanup" }),
      messageId: 99
    });

    store.close();

    const db = new DatabaseSync(paths.dbPath);
    try {
      db.prepare("DELETE FROM schema_migrations WHERE version = 20").run();

      db.exec("ALTER TABLE runtime_notice ADD COLUMN telegram_chat_id TEXT NULL");
      db.exec("UPDATE runtime_notice SET telegram_chat_id = chat_id WHERE telegram_chat_id IS NULL");

      db.exec("ALTER TABLE final_answer_view ADD COLUMN telegram_chat_id TEXT NULL");
      db.exec("ALTER TABLE final_answer_view ADD COLUMN telegram_message_id INTEGER NULL");
      db.exec(
        `
          UPDATE final_answer_view
          SET
            telegram_chat_id = chat_id,
            telegram_message_id = delivery_message_id
        `
      );

      db.exec("ALTER TABLE current_session_card ADD COLUMN telegram_chat_id TEXT NULL");
      db.exec("ALTER TABLE current_session_card ADD COLUMN telegram_message_id INTEGER NULL");
      db.exec(
        `
          UPDATE current_session_card
          SET
            telegram_chat_id = chat_id,
            telegram_message_id = message_id
        `
      );

      db.exec("ALTER TABLE pending_interaction ADD COLUMN telegram_chat_id TEXT NULL");
      db.exec("ALTER TABLE pending_interaction ADD COLUMN telegram_message_id INTEGER NULL");
      db.exec(
        `
          UPDATE pending_interaction
          SET
            telegram_chat_id = chat_id,
            telegram_message_id = message_id
        `
      );
    } finally {
      db.close();
    }

    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      const rawDb = new DatabaseSync(paths.dbPath);
      try {
        const runtimeNoticeColumns = rawDb.prepare("PRAGMA table_info(runtime_notice)").all() as Array<{ name: string }>;
        const terminalResultColumns = rawDb.prepare("PRAGMA table_info(final_answer_view)").all() as Array<{ name: string }>;
        const currentCardColumns = rawDb.prepare("PRAGMA table_info(current_session_card)").all() as Array<{ name: string }>;
        const pendingColumns = rawDb.prepare("PRAGMA table_info(pending_interaction)").all() as Array<{ name: string }>;

        assert.equal(runtimeNoticeColumns.some((column) => column.name === "telegram_chat_id"), false);
        assert.equal(terminalResultColumns.some((column) => column.name === "telegram_chat_id"), false);
        assert.equal(terminalResultColumns.some((column) => column.name === "telegram_message_id"), false);
        assert.equal(currentCardColumns.some((column) => column.name === "telegram_chat_id"), false);
        assert.equal(currentCardColumns.some((column) => column.name === "telegram_message_id"), false);
        assert.equal(pendingColumns.some((column) => column.name === "telegram_chat_id"), false);
        assert.equal(pendingColumns.some((column) => column.name === "telegram_message_id"), false);
      } finally {
        rawDb.close();
      }

      assert.equal(reopened.listRuntimeNotices("chat-mirror-cleanup")[0]?.chatId, "chat-mirror-cleanup");
      assert.equal(reopened.getCurrentSessionCard("chat-mirror-cleanup")?.messageId, 77);
      assert.equal(reopened.getTerminalResultView("answer-mirror-cleanup", "chat-mirror-cleanup")?.deliveryMessageId, 88);
      assert.equal(
        reopened.getPendingInteraction("interaction-mirror-cleanup", "chat-mirror-cleanup")?.messageId,
        99
      );
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("runtime card preferences persist across reopen and default when missing", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    assert.deepEqual(store.getRuntimeCardPreferences().fields, []);

    store.setRuntimeCardPreferences(["thread_id", "turn_id"]);
    store.close();

    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.deepEqual(reopened.getRuntimeCardPreferences().fields, ["thread_id", "turn_id"]);
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("runtime card preferences preserve an explicit empty selection", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    store.setRuntimeCardPreferences([]);
    store.close();

    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.deepEqual(reopened.getRuntimeCardPreferences().fields, []);
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("runtime card preferences lazily migrate legacy runtime field ids to v4 cli ids and keep bridge extensions", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    store.close();

    const db = new DatabaseSync(paths.dbPath);
    db.prepare(
      `
        INSERT OR REPLACE INTO runtime_card_preferences (
          key,
          fields_json,
          updated_at
        )
        VALUES ('global', ?, ?)
      `
    ).run(
      JSON.stringify([
        "project_path",
        "model_reasoning",
        "thread_id",
        "model-name",
        "current_step",
        "final_answer_ready"
      ]),
      "2026-03-16T09:00:00.000Z"
    );
    db.close();

    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.deepEqual(reopened.getRuntimeCardPreferences().fields, [
        "current-dir",
        "model-with-reasoning",
        "session-id",
        "model-name",
        "current_step",
        "final_answer_ready"
      ]);
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("ui language defaults to zh and persists across reopen", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    assert.equal(store.getUiLanguage(), "zh");

    store.setUiLanguage("en");
    store.close();

    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.equal(reopened.getUiLanguage(), "en");
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});

test("turn input source records persist across reopen", async () => {
  const { paths, store, cleanup } = await openStore();

  try {
    store.saveTurnInputSource({
      threadId: "thread-voice",
      turnId: "turn-voice",
      sourceKind: "voice",
      transcript: "打开日志"
    });
    store.close();

    const reopened = await BridgeStateStore.open(paths, testLogger);
    try {
      assert.deepEqual(reopened.getTurnInputSource("thread-voice", "turn-voice"), {
        threadId: "thread-voice",
        turnId: "turn-voice",
        sourceKind: "voice",
        transcript: "打开日志",
        createdAt: reopened.getTurnInputSource("thread-voice", "turn-voice")?.createdAt ?? ""
      });
    } finally {
      reopened.close();
    }
  } finally {
    await cleanup();
  }
});
