import * as Lark from "@larksuiteoapi/node-sdk";

import type { BridgeConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { BridgePaths } from "../paths.js";
import { getFeishuPackConfig } from "../packs/feishu/config.js";
import type {
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser
} from "../telegram/api.js";
import { resolveFeishuSdkDomain, type FeishuTelegramApiCompat } from "./api.js";

interface PendingQueueWaiter {
  resolve(): void;
}

interface FeishuEventDispatcherLike {
  register(handles: Record<string, (event: any) => Promise<unknown> | unknown>): unknown;
}

interface FeishuWsClientLike {
  start(params: {
    eventDispatcher: FeishuEventDispatcherLike;
  }): Promise<void>;
  close(params?: {
    force?: boolean;
  }): void;
}

interface FeishuTelegramPollerCompatDeps {
  createWsClient?: (options: {
    appId: string;
    appSecret: string;
    apiBaseUrl: string;
  }) => FeishuWsClientLike;
  createEventDispatcher?: () => FeishuEventDispatcherLike;
  maxQueueSize?: number;
}

const DEFAULT_MAX_PENDING_UPDATES = 1000;

export function buildFeishuWsClientOptions(options: {
  appId: string;
  appSecret: string;
  apiBaseUrl: string;
}): ConstructorParameters<typeof Lark.WSClient>[0] {
  return {
    appId: options.appId,
    appSecret: options.appSecret,
    domain: resolveFeishuSdkDomain(options.apiBaseUrl),
    autoReconnect: true
  };
}

function parseFeishuTextContent(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { text?: string };
    return typeof parsed.text === "string" ? parsed.text : null;
  } catch {
    return null;
  }
}

export class FeishuTelegramPollerCompat {
  private readonly api: FeishuTelegramApiCompat;
  private readonly logger: Logger;
  private readonly onUpdate: (update: TelegramUpdate) => Promise<void>;
  private readonly config: BridgeConfig;
  private readonly deps: FeishuTelegramPollerCompatDeps;
  private readonly maxQueueSize: number;
  private wsClient: FeishuWsClientLike | null = null;
  private eventDispatcher: FeishuEventDispatcherLike | null = null;
  private readonly queue: TelegramUpdate[] = [];
  private waiter: PendingQueueWaiter | null = null;
  private running = false;
  private nextUpdateId = 1;
  private queueOverflowLogged = false;

  constructor(
    api: FeishuTelegramApiCompat,
    config: BridgeConfig,
    _paths: BridgePaths,
    logger: Logger,
    onUpdate: (update: TelegramUpdate) => Promise<void>,
    deps: FeishuTelegramPollerCompatDeps = {}
  ) {
    this.api = api;
    this.logger = logger;
    this.onUpdate = onUpdate;
    this.config = config;
    this.deps = deps;
    this.maxQueueSize = Math.max(1, deps.maxQueueSize ?? DEFAULT_MAX_PENDING_UPDATES);
  }

  async run(): Promise<void> {
    this.running = true;
    await this.api.ready();
    this.ensureTransport();
    await this.wsClient!.start({
      eventDispatcher: this.eventDispatcher!
    });

    while (this.running) {
      if (this.queue.length === 0) {
        await new Promise<void>((resolve) => {
          this.waiter = { resolve };
        });
        this.waiter = null;
        continue;
      }

      const update = this.queue.shift();
      if (!update) {
        continue;
      }

      try {
        await this.onUpdate(update);
      } catch (error) {
        await this.logger.warn("feishu compat poller failed to handle translated update", {
          error: `${error}`
        });
      }
    }
  }

  stop(): void {
    this.running = false;
    this.wsClient?.close({ force: true });
    this.waiter?.resolve();
  }

  private enqueue(update: TelegramUpdate): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      if (!this.queueOverflowLogged) {
        this.queueOverflowLogged = true;
        void this.logger.warn("feishu compat poller queue overflow; dropping oldest update", {
          maxQueueSize: this.maxQueueSize
        });
      }
    }
    this.queue.push(update);
    this.waiter?.resolve();
  }

  private async translateMessageEvent(event: {
    sender: {
      sender_id?: {
        open_id?: string;
      };
    };
    message: {
      message_id: string;
      chat_id: string;
      create_time: string;
      message_type: string;
      content: string;
    };
  }): Promise<TelegramUpdate | null> {
    if (event.message.message_type !== "text") {
      return null;
    }

    const remoteOpenId = event.sender.sender_id?.open_id;
    const text = parseFeishuTextContent(event.message.content);
    if (!remoteOpenId || !text) {
      return null;
    }

    const refs = this.api.refsStore;
    const localUserId = refs.getOrCreateLocalUserId(remoteOpenId);
    const localChatId = refs.getOrCreateLocalChatId(event.message.chat_id);
    const localMessageId = refs.recordRemoteMessage(event.message.message_id, event.message.chat_id);
    const message: TelegramMessage = {
      message_id: localMessageId,
      from: this.buildTelegramUser(localUserId, remoteOpenId),
      chat: {
        id: localChatId,
        type: "private"
      },
      date: Math.floor(Number.parseInt(event.message.create_time, 10) / 1000),
      text
    };

    return {
      update_id: this.nextUpdateId++,
      message
    };
  }

  private async translateCardCallbackEvent(event: {
    open_id?: string;
    open_message_id?: string;
    token: string;
    operator?: {
      open_id?: string;
    };
    context?: {
      open_message_id?: string;
    };
    action?: {
      value?: Record<string, unknown>;
    };
  }): Promise<TelegramUpdate | null> {
    const remoteOpenId = event.open_id ?? event.operator?.open_id ?? null;
    const remoteMessageId = event.open_message_id ?? event.context?.open_message_id ?? null;
    const callbackData = typeof event.action?.value?.callback_data === "string"
      ? event.action.value.callback_data
      : null;
    if (!callbackData || !remoteOpenId || !remoteMessageId) {
      return null;
    }

    const refs = this.api.refsStore;
    const localUserId = refs.getOrCreateLocalUserId(remoteOpenId);
    const remoteRef = refs.resolveRemoteMessageByRemoteId(remoteMessageId);
    if (!remoteRef) {
      return null;
    }
    const localChatId = refs.getOrCreateLocalChatId(remoteRef.remoteChatId);
    const callbackQuery: TelegramCallbackQuery = {
      id: event.token,
      from: this.buildTelegramUser(localUserId, remoteOpenId),
      data: callbackData,
      message: {
        message_id: remoteRef.localMessageId,
        chat: {
          id: localChatId,
          type: "private"
        },
        date: Math.floor(Date.now() / 1000)
      }
    };

    return {
      update_id: this.nextUpdateId++,
      callback_query: callbackQuery
    };
  }

  private buildTelegramUser(localUserId: number, remoteOpenId: string): TelegramUser {
    return {
      id: localUserId,
      is_bot: false,
      first_name: remoteOpenId,
      username: remoteOpenId
    };
  }

  private ensureTransport(): void {
    if (this.wsClient && this.eventDispatcher) {
      return;
    }

    const feishuConfig = getFeishuPackConfig(this.config);
    const wsClient = this.deps.createWsClient
      ? this.deps.createWsClient({
        appId: feishuConfig.appId,
        appSecret: feishuConfig.appSecret,
        apiBaseUrl: feishuConfig.apiBaseUrl
      })
      : new Lark.WSClient(buildFeishuWsClientOptions({
        appId: feishuConfig.appId,
        appSecret: feishuConfig.appSecret,
        apiBaseUrl: feishuConfig.apiBaseUrl
      }));
    const eventDispatcher = this.deps.createEventDispatcher
      ? this.deps.createEventDispatcher()
      : new Lark.EventDispatcher({});
    eventDispatcher.register({
      "im.message.receive_v1": async (event: {
        sender: {
          sender_id?: {
            open_id?: string;
          };
        };
        message: {
          message_id: string;
          chat_id: string;
          create_time: string;
          message_type: string;
          content: string;
        };
      }) => {
        const update = await this.translateMessageEvent(event);
        if (update) {
          this.enqueue(update);
        }
      },
      "card.action.trigger": async (event: {
        open_id?: string;
        open_message_id?: string;
        token: string;
        operator?: {
          open_id?: string;
        };
        context?: {
          open_message_id?: string;
        };
        action?: {
          value?: Record<string, unknown>;
        };
      }) => {
        const update = await this.translateCardCallbackEvent(event);
        if (update) {
          this.enqueue(update);
        }
        return {};
      }
    });
    this.wsClient = wsClient;
    this.eventDispatcher = eventDispatcher;
  }
}
