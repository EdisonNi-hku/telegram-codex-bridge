import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FeishuTelegramApiCompat } from "./api.js";
import { buildFeishuWsClientOptions, FeishuTelegramPollerCompat } from "./poller.js";
import type { BridgeConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { BridgePaths } from "../paths.js";
import { encodeCommandPanelRunCallback, encodeStatusInterruptCallback } from "../telegram/ui-callbacks.js";

const testLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {}
};

function createPaths(root: string): BridgePaths {
  const logsDir = join(root, "logs");
  const runtimeDir = join(root, "runtime");
  const telegramSessionFlowLogsDir = join(logsDir, "telegram-session-flow");

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

function createConfig(): BridgeConfig {
  return {
    activePack: "feishu",
    shared: {
      activePack: "feishu",
      codexBin: "codex",
      projectScanRoots: [],
      voiceInputEnabled: false,
      voiceOpenaiApiKey: "",
      voiceOpenaiTranscribeModel: "gpt-4o-mini-transcribe",
      voiceFfmpegBin: "ffmpeg",
      perfMonitorEnabled: false,
      perfMonitorSampleIntervalMs: 15_000,
      perfMonitorRetentionDays: 7,
      appServerGuardEnabled: true,
      appServerGuardSampleIntervalMs: 30_000,
      appServerGuardMcpWorkerThreshold: 6,
      appServerGuardConsecutiveWindows: 3,
      appServerGuardCooldownMs: 900_000
    },
    packs: {
      feishu: {
        appId: "cli_test",
        appSecret: "secret",
        apiBaseUrl: "https://open.feishu.cn"
      }
    },
    codexBin: "codex",
    projectScanRoots: [],
    voiceInputEnabled: false,
    voiceOpenaiApiKey: "",
    voiceOpenaiTranscribeModel: "gpt-4o-mini-transcribe",
    voiceFfmpegBin: "ffmpeg",
    perfMonitorEnabled: false,
    perfMonitorSampleIntervalMs: 15_000,
    perfMonitorRetentionDays: 7,
    appServerGuardEnabled: true,
    appServerGuardSampleIntervalMs: 30_000,
    appServerGuardMcpWorkerThreshold: 6,
    appServerGuardConsecutiveWindows: 3,
    appServerGuardCooldownMs: 900_000
  };
}

test("FeishuTelegramPollerCompat translates message receive events into Telegram-compatible updates", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      testLogger,
      async () => {},
      {
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: () => {}
        })
      }
    );

    const update = await (poller as any).translateMessageEvent({
      sender: {
        sender_id: {
          open_id: "ou_user_1"
        }
      },
      message: {
        message_id: "om_message_1",
        chat_id: "oc_chat_1",
        create_time: "1710000000000",
        message_type: "text",
        content: JSON.stringify({
          text: "/status"
        })
      }
    });

    assert.equal(update?.message?.text, "/status");
    assert.equal(update?.message?.chat.type, "private");
    assert.equal(typeof update?.message?.message_id, "number");
    assert.equal(typeof update?.message?.from?.id, "number");
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("FeishuTelegramPollerCompat translates image receive events into bridge media updates", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      testLogger,
      async () => {},
      {
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: () => {}
        })
      }
    );

    const update = await (poller as any).translateMessageEvent({
      sender: {
        sender_id: {
          open_id: "ou_user_2"
        }
      },
      message: {
        message_id: "om_message_image",
        chat_id: "oc_chat_2",
        create_time: "1710000001000",
        message_type: "image",
        content: JSON.stringify({
          image_key: "img_key_1"
        })
      }
    });

    assert.equal(update?.message?.bridgeMedia?.[0]?.kind, "image");
    assert.equal(update?.message?.bridgeMedia?.[0]?.resourceId, "img_key_1");
    assert.equal(update?.message?.bridgeMedia?.[0]?.platformRef.platform, "feishu");
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("FeishuTelegramPollerCompat translates post messages with pasted images into bridge media updates", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      testLogger,
      async () => {},
      {
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: () => {}
        })
      }
    );

    const update = await (poller as any).translateMessageEvent({
      sender: {
        sender_id: {
          open_id: "ou_user_3"
        }
      },
      message: {
        message_id: "om_message_post_image",
        chat_id: "oc_chat_3",
        create_time: "1710000002000",
        message_type: "post",
        content: JSON.stringify({
          title: "",
          content: [[{
            tag: "img",
            image_key: "img_key_post_1"
          }]]
        })
      }
    });

    assert.equal(update?.message?.bridgeMedia?.[0]?.kind, "image");
    assert.equal(update?.message?.bridgeMedia?.[0]?.resourceId, "img_key_post_1");
    assert.equal(update?.message?.bridgeMedia?.[0]?.platformRef.platform, "feishu");
    assert.equal(update?.message?.text, undefined);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("FeishuTelegramPollerCompat accepts modern nested card callback payloads", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    await api.ready();
    const refs = api.refsStore;
    refs.getOrCreateLocalUserId("ou_user_1");
    refs.getOrCreateLocalChatId("oc_chat_1");
    const localMessageId = refs.recordRemoteMessage("om_message_1", "oc_chat_1");
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      testLogger,
      async () => {},
      {
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: () => {}
        })
      }
    );

    const update = await (poller as any).translateCardCallbackEvent({
      token: "callback-token",
      operator: {
        open_id: "ou_user_1"
      },
      context: {
        open_message_id: "om_message_1"
      },
      action: {
        value: {
          callback_data: "runtime:refresh"
        }
      }
    });

    assert.equal(update?.callback_query?.id, "callback-token");
    assert.equal(update?.callback_query?.data, "runtime:refresh");
    assert.equal(update?.callback_query?.message?.message_id, localMessageId);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("FeishuTelegramPollerCompat translates p2p chat-entered events into platform events", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      testLogger,
      async () => {},
      {
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: () => {}
        })
      }
    );

    const update = await (poller as any).translateChatEnteredEvent({
      chat_id: "oc_chat_entered_1",
      operator_id: {
        open_id: "ou_user_entered_1"
      }
    });

    assert.equal(update?.platform_event?.kind, "chat_entered");
    assert.equal(update?.platform_event?.source, "feishu");
    assert.equal(update?.platform_event?.user.username, "ou_user_entered_1");
    assert.equal(
      api.refsStore.resolveLocalChatIdForRemoteUser("ou_user_entered_1"),
      update?.platform_event?.chat.id
    );
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("FeishuTelegramPollerCompat resolves bot-menu events through the remembered user chat", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      testLogger,
      async () => {},
      {
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: () => {}
        })
      }
    );

    const messageUpdate = await (poller as any).translateMessageEvent({
      sender: {
        sender_id: {
          open_id: "ou_user_menu_1"
        }
      },
      message: {
        message_id: "om_message_menu_1",
        chat_id: "oc_chat_menu_1",
        create_time: "1710000000000",
        message_type: "text",
        content: JSON.stringify({
          text: "hello"
        })
      }
    });
    const menuUpdate = await (poller as any).translateBotMenuEvent({
      event_key: "bridge_status",
      operator: {
        operator_id: {
          open_id: "ou_user_menu_1"
        }
      }
    });

    assert.equal(messageUpdate?.message?.chat.id, menuUpdate?.platform_event?.chat.id);
    assert.equal(menuUpdate?.platform_event?.kind, "bot_menu");
    assert.equal(menuUpdate?.platform_event?.eventKey, "bridge_status");
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("FeishuTelegramPollerCompat accepts overflow option values as callback payloads", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    await api.ready();
    const refs = api.refsStore;
    refs.getOrCreateLocalUserId("ou_user_overflow_1");
    refs.getOrCreateLocalChatId("oc_chat_overflow_1");
    refs.rememberUserChat("ou_user_overflow_1", "oc_chat_overflow_1");
    const localMessageId = refs.recordRemoteMessage("om_message_overflow_1", "oc_chat_overflow_1");
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      testLogger,
      async () => {},
      {
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: () => {}
        })
      }
    );

    const callbackData = encodeCommandPanelRunCallback("status");
    const update = await (poller as any).translateCardCallbackEvent({
      token: "callback-token-overflow",
      operator: {
        open_id: "ou_user_overflow_1"
      },
      context: {
        open_message_id: "om_message_overflow_1",
        open_chat_id: "oc_chat_overflow_1"
      },
      action: {
        tag: "overflow",
        option: callbackData
      }
    });

    assert.equal(update?.callback_query?.data, callbackData);
    assert.equal(update?.callback_query?.message?.message_id, localMessageId);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("FeishuTelegramPollerCompat returns immediate toast feedback for accepted card callbacks", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);
  let registeredHandlers: Record<string, (event: any) => Promise<unknown> | unknown> = {};

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    await api.ready();
    const refs = api.refsStore;
    refs.getOrCreateLocalUserId("ou_user_callback_1");
    refs.getOrCreateLocalChatId("oc_chat_callback_1");
    refs.recordRemoteMessage("om_message_callback_1", "oc_chat_callback_1");
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      testLogger,
      async () => {},
      {
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: (handlers) => {
            registeredHandlers = handlers;
          }
        })
      }
    );

    (poller as any).ensureTransport();
    const callbackData = encodeStatusInterruptCallback("session-1");
    const response = await registeredHandlers["card.action.trigger"]?.({
      token: "callback-trigger-token",
      operator: {
        open_id: "ou_user_callback_1"
      },
      context: {
        open_message_id: "om_message_callback_1",
        open_chat_id: "oc_chat_callback_1"
      },
      action: {
        value: {
          callback_data: callbackData
        }
      }
    }) as Record<string, any>;

    assert.equal(response.toast?.type, "warning");
    assert.equal(response.toast?.content, "正在请求中断…");
    assert.equal((poller as any).queue[0]?.callback_query?.data, callbackData);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("FeishuTelegramPollerCompat bounds queued updates when downstream handling stalls", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-poller-test-"));
  const paths = createPaths(root);
  const warnings: Array<Record<string, unknown> | undefined> = [];

  try {
    const api = new FeishuTelegramApiCompat({
      appId: "cli_test",
      appSecret: "secret",
      apiBaseUrl: "https://open.feishu.cn"
    }, paths);
    const poller = new FeishuTelegramPollerCompat(
      api,
      createConfig(),
      paths,
      {
        ...testLogger,
        warn: async (_message, meta) => {
          warnings.push(meta);
        }
      },
      async () => {},
      {
        maxQueueSize: 2,
        createWsClient: () => ({
          start: async () => {},
          close: () => {}
        }),
        createEventDispatcher: () => ({
          register: () => {}
        })
      }
    );

    (poller as any).enqueue({ update_id: 1 });
    (poller as any).enqueue({ update_id: 2 });
    (poller as any).enqueue({ update_id: 3 });

    assert.deepEqual((poller as any).queue.map((update: { update_id: number }) => update.update_id), [2, 3]);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.maxQueueSize, 2);
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

test("buildFeishuWsClientOptions preserves custom api base urls", () => {
  assert.deepEqual(buildFeishuWsClientOptions({
    appId: "cli_test",
    appSecret: "secret",
    apiBaseUrl: "https://proxy.example.test"
  }), {
    appId: "cli_test",
    appSecret: "secret",
    domain: "https://proxy.example.test",
    autoReconnect: true
  });
});
