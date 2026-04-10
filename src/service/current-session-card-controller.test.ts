import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BridgePaths } from "../paths.js";
import { BridgeStateStore } from "../state/store.js";
import { CurrentSessionCardController } from "./current-session-card-controller.js";

function createTestPaths(root: string): BridgePaths {
  const logsDir = join(root, "logs");
  const runtimeDir = join(root, "runtime");

  return {
    homeDir: root,
    repoRoot: root,
    installRoot: join(root, "install"),
    stateRoot: join(root, "state"),
    configRoot: join(root, "config"),
    logsDir,
    perfLogsDir: join(logsDir, "perf"),
    telegramSessionFlowLogsDir: join(logsDir, "telegram-session-flow"),
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
    telegramStatusCardLogPath: join(logsDir, "status-card.log"),
    telegramPlanCardLogPath: join(logsDir, "plan-card.log"),
    telegramErrorCardLogPath: join(logsDir, "error-card.log")
  };
}

async function createControllerContext() {
  const root = await mkdtemp(join(tmpdir(), "ctb-current-session-card-test-"));
  const paths = createTestPaths(root);
  await Promise.all([
    mkdir(paths.installRoot, { recursive: true }),
    mkdir(paths.stateRoot, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.configRoot, { recursive: true })
  ]);

  const store = await BridgeStateStore.open(paths, {
    info: async () => {},
    warn: async () => {},
    error: async () => {}
  });
  const sent: Array<{ chatId: string; text: string }> = [];
  const edited: Array<{ chatId: string; messageId: number; text: string }> = [];
  const deleted: Array<{ chatId: string; messageId: number }> = [];
  const pinned: Array<{ chatId: string; messageId: number }> = [];
  const unpinned: Array<{ chatId: string; messageId: number }> = [];
  let nextMessageId = 700;
  let editOutcome: "edited" | "failed" = "edited";

  const controller = new CurrentSessionCardController({
    logger: { warn: async () => {} },
    getStore: () => store,
    getUiLanguage: () => "zh",
    safeSendHtmlMessageResult: async (chatId, text) => {
      const messageId = nextMessageId++;
      sent.push({ chatId, text });
      return { message_id: messageId };
    },
    safeEditHtmlMessageText: async (chatId, messageId, text) => {
      edited.push({ chatId, messageId, text });
      return editOutcome === "edited" ? { outcome: "edited" } : { outcome: "failed" };
    },
    safeDeleteMessage: async (chatId, messageId) => {
      deleted.push({ chatId, messageId });
      return { outcome: "deleted" };
    },
    safePinChatMessage: async (chatId, messageId) => {
      pinned.push({ chatId, messageId });
      return true;
    },
    safeUnpinChatMessage: async (chatId, messageId) => {
      unpinned.push({ chatId, messageId });
      return true;
    },
    resolveSessionModelState: async (session) => ({
      configuredModel: session.selectedModel,
      configuredReasoningEffort: session.selectedReasoningEffort,
      effectiveModel: session.selectedModel,
      effectiveReasoningEffort: session.selectedReasoningEffort
    })
  });

  return {
    controller,
    store,
    sent,
    edited,
    deleted,
    pinned,
    unpinned,
    setEditOutcome: (outcome: "edited" | "failed") => {
      editOutcome = outcome;
    },
    cleanup: async () => {
      store.close();
      await rm(root, { recursive: true, force: true });
    }
  };
}

function authorizeChat(store: BridgeStateStore, chatId: string): void {
  store.upsertPendingAuthorization({
    userId: "user-1",
    chatId: chatId,
    username: "tester",
    displayName: "Tester"
  });

  const candidate = store.listPendingAuthorizations()[0];
  assert.ok(candidate);
  store.confirmPendingAuthorization(candidate);
}

test("CurrentSessionCardController sends and pins a new card for the active session", async () => {
  const { controller, store, sent, pinned, cleanup } = await createControllerContext();

  try {
    authorizeChat(store, "chat-1");
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      displayName: "Session One"
    });
    store.setActiveSession("chat-1", session.sessionId);

    await controller.syncForChat("chat-1", "session_switched");

    assert.equal(sent.length, 1);
    assert.match(sent[0]?.text ?? "", /^Project One \/ Session One/u);
    assert.deepEqual(pinned, [{ chatId: "chat-1", messageId: 700 }]);
    assert.equal(store.getCurrentSessionCard("chat-1")?.messageId, 700);
    assert.equal(store.getCurrentSessionCard("chat-1")?.sessionId, session.sessionId);
  } finally {
    await cleanup();
  }
});

test("CurrentSessionCardController edits the existing card in place when possible", async () => {
  const { controller, store, edited, sent, pinned, cleanup } = await createControllerContext();

  try {
    authorizeChat(store, "chat-1");
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      displayName: "Session One"
    });
    store.setActiveSession("chat-1", session.sessionId);
    store.upsertCurrentSessionCard({
      chatId: "chat-1",
      messageId: 812,
      sessionId: session.sessionId
    });

    await controller.syncForChat("chat-1", "session_renamed");

    assert.deepEqual(sent, []);
    assert.equal(edited[0]?.messageId, 812);
    assert.deepEqual(pinned, [{ chatId: "chat-1", messageId: 812 }]);
    assert.equal(store.getCurrentSessionCard("chat-1")?.messageId, 812);
  } finally {
    await cleanup();
  }
});

test("CurrentSessionCardController recreates the card on session switch to re-anchor the current session surface", async () => {
  const { controller, store, sent, edited, deleted, pinned, unpinned, cleanup } = await createControllerContext();

  try {
    authorizeChat(store, "chat-1");
    const previousSession = store.createSession({
      chatId: "chat-1",
      projectName: "Project Zero",
      projectPath: "/tmp/project-zero",
      displayName: "Session Zero"
    });
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      displayName: "Session One"
    });
    store.setActiveSession("chat-1", session.sessionId);
    store.upsertCurrentSessionCard({
      chatId: "chat-1",
      messageId: 812,
      sessionId: previousSession.sessionId
    });

    await controller.syncForChat("chat-1", "session_switched");

    assert.deepEqual(edited, []);
    assert.equal(sent.length, 1);
    assert.deepEqual(pinned, [{ chatId: "chat-1", messageId: 700 }]);
    assert.deepEqual(unpinned, [{ chatId: "chat-1", messageId: 812 }]);
    assert.deepEqual(deleted, [{ chatId: "chat-1", messageId: 812 }]);
    assert.equal(store.getCurrentSessionCard("chat-1")?.messageId, 700);
  } finally {
    await cleanup();
  }
});

test("CurrentSessionCardController recreates the card on startup restore to avoid reusing a stale pinned surface", async () => {
  const { controller, store, sent, edited, deleted, pinned, unpinned, cleanup } = await createControllerContext();

  try {
    authorizeChat(store, "chat-1");
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      displayName: "Session One"
    });
    store.setActiveSession("chat-1", session.sessionId);
    store.upsertCurrentSessionCard({
      chatId: "chat-1",
      messageId: 812,
      sessionId: session.sessionId
    });

    await controller.syncForChat("chat-1", "startup_restore");

    assert.deepEqual(edited, []);
    assert.equal(sent.length, 1);
    assert.deepEqual(pinned, [{ chatId: "chat-1", messageId: 700 }]);
    assert.deepEqual(unpinned, [{ chatId: "chat-1", messageId: 812 }]);
    assert.deepEqual(deleted, [{ chatId: "chat-1", messageId: 812 }]);
    assert.equal(store.getCurrentSessionCard("chat-1")?.messageId, 700);
  } finally {
    await cleanup();
  }
});

test("CurrentSessionCardController recreates the card when a new session becomes current", async () => {
  const { controller, store, sent, edited, deleted, pinned, unpinned, cleanup } = await createControllerContext();

  try {
    authorizeChat(store, "chat-1");
    const previousSession = store.createSession({
      chatId: "chat-1",
      projectName: "Project Zero",
      projectPath: "/tmp/project-zero",
      displayName: "Session Zero"
    });
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      displayName: "Session One"
    });
    store.setActiveSession("chat-1", session.sessionId);
    store.upsertCurrentSessionCard({
      chatId: "chat-1",
      messageId: 812,
      sessionId: previousSession.sessionId
    });

    await controller.syncForChat("chat-1", "session_created");

    assert.deepEqual(edited, []);
    assert.equal(sent.length, 1);
    assert.deepEqual(pinned, [{ chatId: "chat-1", messageId: 700 }]);
    assert.deepEqual(unpinned, [{ chatId: "chat-1", messageId: 812 }]);
    assert.deepEqual(deleted, [{ chatId: "chat-1", messageId: 812 }]);
    assert.equal(store.getCurrentSessionCard("chat-1")?.messageId, 700);
  } finally {
    await cleanup();
  }
});

test("CurrentSessionCardController replaces and cleans up the old card when edit fails", async () => {
  const {
    controller,
    store,
    sent,
    edited,
    deleted,
    pinned,
    unpinned,
    setEditOutcome,
    cleanup
  } = await createControllerContext();

  try {
    authorizeChat(store, "chat-1");
    const session = store.createSession({
      chatId: "chat-1",
      projectName: "Project One",
      projectPath: "/tmp/project-one",
      displayName: "Session One"
    });
    store.setActiveSession("chat-1", session.sessionId);
    store.upsertCurrentSessionCard({
      chatId: "chat-1",
      messageId: 811,
      sessionId: session.sessionId
    });
    setEditOutcome("failed");

    await controller.syncForChat("chat-1", "session_switched");

    assert.equal(edited[0]?.messageId, 811);
    assert.equal(sent.length, 1);
    assert.deepEqual(pinned, [{ chatId: "chat-1", messageId: 700 }]);
    assert.deepEqual(unpinned, [{ chatId: "chat-1", messageId: 811 }]);
    assert.deepEqual(deleted, [{ chatId: "chat-1", messageId: 811 }]);
    assert.equal(store.getCurrentSessionCard("chat-1")?.messageId, 700);
  } finally {
    await cleanup();
  }
});

test("CurrentSessionCardController removes the card when no active session remains", async () => {
  const { controller, store, deleted, unpinned, cleanup } = await createControllerContext();

  try {
    authorizeChat(store, "chat-1");
    store.upsertCurrentSessionCard({
      chatId: "chat-1",
      messageId: 900,
      sessionId: "session-old"
    });

    await controller.syncForChat("chat-1", "session_archived");

    assert.deepEqual(unpinned, [{ chatId: "chat-1", messageId: 900 }]);
    assert.deepEqual(deleted, [{ chatId: "chat-1", messageId: 900 }]);
    assert.equal(store.getCurrentSessionCard("chat-1"), null);
  } finally {
    await cleanup();
  }
});
