import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { BridgePaths } from "../../paths.js";

const FEISHU_CHAT_ID_BASE = 7_000_000_000_000_000;
const FEISHU_USER_ID_BASE = 7_500_000_000_000_000;
const FEISHU_MESSAGE_ID_BASE = 8_000_000_000_000_000;
const FEISHU_LOCAL_ID_MOD = 500_000_000_000_000;

interface FeishuCompatRefsRecord {
  version: 1;
  nextMessageOffset: number;
  chatRemoteByLocal: Record<string, string>;
  chatLocalByRemote: Record<string, number>;
  userChatRemoteByUser: Record<string, string>;
  userRemoteByLocal: Record<string, string>;
  userLocalByRemote: Record<string, number>;
  messageRemoteByLocal: Record<string, {
    remoteMessageId: string;
    remoteChatId: string;
  }>;
  messageLocalByRemote: Record<string, number>;
}

type FeishuCompatRefsOperation =
  | {
    op: "chat_put";
    remoteChatId: string;
    localChatId: number;
  }
  | {
    op: "user_put";
    remoteOpenId: string;
    localUserId: number;
  }
  | {
    op: "user_chat_put";
    remoteOpenId: string;
    remoteChatId: string;
  }
  | {
    op: "message_put";
    remoteMessageId: string;
    remoteChatId: string;
    localMessageId: number;
  }
  | {
    op: "message_delete";
    localMessageId: number;
  };

function stableLocalId(base: number, remoteId: string): number {
  const digest = createHash("sha1").update(remoteId).digest("hex").slice(0, 12);
  const value = Number.parseInt(digest, 16) % FEISHU_LOCAL_ID_MOD;
  return base + value;
}

function createEmptyRecord(): FeishuCompatRefsRecord {
  return {
    version: 1,
    nextMessageOffset: 1,
    chatRemoteByLocal: {},
    chatLocalByRemote: {},
    userChatRemoteByUser: {},
    userRemoteByLocal: {},
    userLocalByRemote: {},
    messageRemoteByLocal: {},
    messageLocalByRemote: {}
  };
}

export class FeishuCompatRefs {
  private readonly filePath: string;
  private readonly logPath: string;
  private record: FeishuCompatRefsRecord = createEmptyRecord();
  private loaded = false;

  constructor(paths: Pick<BridgePaths, "runtimeDir">) {
    this.filePath = join(paths.runtimeDir, "feishu-compat-refs.json");
    this.logPath = join(paths.runtimeDir, "feishu-compat-refs.log");
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const content = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content) as Partial<FeishuCompatRefsRecord>;
      if (parsed.version === 1) {
        this.record = {
          ...createEmptyRecord(),
          ...parsed
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    try {
      const logContent = await readFile(this.logPath, "utf8");
      for (const line of logContent.split(/\r?\n/u)) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        this.applyOperation(JSON.parse(trimmed) as FeishuCompatRefsOperation);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    this.loaded = true;
  }

  async ready(): Promise<void> {
    await this.load();
  }

  getOrCreateLocalChatId(remoteChatId: string): number {
    const existing = this.record.chatLocalByRemote[remoteChatId];
    if (existing) {
      return existing;
    }

    const local = stableLocalId(FEISHU_CHAT_ID_BASE, remoteChatId);
    this.record.chatLocalByRemote[remoteChatId] = local;
    this.record.chatRemoteByLocal[`${local}`] = remoteChatId;
    this.appendOperation({
      op: "chat_put",
      remoteChatId,
      localChatId: local
    });
    return local;
  }

  getOrCreateLocalUserId(remoteOpenId: string): number {
    const existing = this.record.userLocalByRemote[remoteOpenId];
    if (existing) {
      return existing;
    }

    const local = stableLocalId(FEISHU_USER_ID_BASE, remoteOpenId);
    this.record.userLocalByRemote[remoteOpenId] = local;
    this.record.userRemoteByLocal[`${local}`] = remoteOpenId;
    this.appendOperation({
      op: "user_put",
      remoteOpenId,
      localUserId: local
    });
    return local;
  }

  rememberUserChat(remoteOpenId: string, remoteChatId: string): void {
    if (this.record.userChatRemoteByUser[remoteOpenId] === remoteChatId) {
      return;
    }

    this.record.userChatRemoteByUser[remoteOpenId] = remoteChatId;
    this.appendOperation({
      op: "user_chat_put",
      remoteOpenId,
      remoteChatId
    });
  }

  resolveRemoteChatId(localChatId: string | number): string | null {
    return this.record.chatRemoteByLocal[`${localChatId}`] ?? null;
  }

  resolveRemoteChatIdForRemoteUser(remoteOpenId: string): string | null {
    return this.record.userChatRemoteByUser[remoteOpenId] ?? null;
  }

  resolveLocalChatIdForRemoteUser(remoteOpenId: string): number | null {
    const remoteChatId = this.resolveRemoteChatIdForRemoteUser(remoteOpenId);
    if (!remoteChatId) {
      return null;
    }

    return this.record.chatLocalByRemote[remoteChatId] ?? null;
  }

  resolveRemoteUserId(localUserId: string | number): string | null {
    return this.record.userRemoteByLocal[`${localUserId}`] ?? null;
  }

  recordRemoteMessage(remoteMessageId: string, remoteChatId: string): number {
    const existing = this.record.messageLocalByRemote[remoteMessageId];
    if (existing) {
      this.upsertRemoteMessageMapping(existing, remoteMessageId, remoteChatId);
      this.appendOperation({
        op: "message_put",
        remoteMessageId,
        remoteChatId,
        localMessageId: existing
      });
      return existing;
    }

    const local = stableLocalId(FEISHU_MESSAGE_ID_BASE, remoteMessageId);
    this.upsertRemoteMessageMapping(local, remoteMessageId, remoteChatId);
    this.appendOperation({
      op: "message_put",
      remoteMessageId,
      remoteChatId,
      localMessageId: local
    });
    return local;
  }

  replaceRemoteMessage(localMessageId: number, remoteMessageId: string, remoteChatId: string): void {
    this.upsertRemoteMessageMapping(localMessageId, remoteMessageId, remoteChatId);
    this.appendOperation({
      op: "message_put",
      remoteMessageId,
      remoteChatId,
      localMessageId
    });
  }

  resolveRemoteMessage(localMessageId: string | number): {
    remoteMessageId: string;
    remoteChatId: string;
  } | null {
    return this.record.messageRemoteByLocal[`${localMessageId}`] ?? null;
  }

  resolveLocalMessageIdByRemote(remoteMessageId: string): number | null {
    return this.record.messageLocalByRemote[remoteMessageId] ?? null;
  }

  resolveRemoteMessageByRemoteId(remoteMessageId: string): {
    localMessageId: number;
    remoteMessageId: string;
    remoteChatId: string;
  } | null {
    const localMessageId = this.resolveLocalMessageIdByRemote(remoteMessageId);
    if (localMessageId === null) {
      return null;
    }

    const remote = this.resolveRemoteMessage(localMessageId);
    if (!remote) {
      return null;
    }

    return {
      localMessageId,
      ...remote
    };
  }

  removeRemoteMessage(localMessageId: string | number): void {
    const existing = this.record.messageRemoteByLocal[`${localMessageId}`];
    if (!existing) {
      return;
    }

    delete this.record.messageRemoteByLocal[`${localMessageId}`];
    delete this.record.messageLocalByRemote[existing.remoteMessageId];
    this.appendOperation({
      op: "message_delete",
      localMessageId: Number.parseInt(`${localMessageId}`, 10)
    });
  }

  isFeishuUserLocalId(userId: string | number | null | undefined): boolean {
    const parsed = typeof userId === "number" ? userId : Number.parseInt(`${userId ?? ""}`, 10);
    return Number.isFinite(parsed) && parsed >= FEISHU_USER_ID_BASE && parsed < FEISHU_MESSAGE_ID_BASE;
  }

  private appendOperation(operation: FeishuCompatRefsOperation): void {
    mkdirSync(dirname(this.logPath), { recursive: true });
    appendFileSync(this.logPath, `${JSON.stringify(operation)}\n`, "utf8");
  }

  private applyOperation(operation: FeishuCompatRefsOperation): void {
    switch (operation.op) {
      case "chat_put":
        this.record.chatLocalByRemote[operation.remoteChatId] = operation.localChatId;
        this.record.chatRemoteByLocal[`${operation.localChatId}`] = operation.remoteChatId;
        break;
      case "user_put":
        this.record.userLocalByRemote[operation.remoteOpenId] = operation.localUserId;
        this.record.userRemoteByLocal[`${operation.localUserId}`] = operation.remoteOpenId;
        break;
      case "user_chat_put":
        this.record.userChatRemoteByUser[operation.remoteOpenId] = operation.remoteChatId;
        break;
      case "message_put":
        this.upsertRemoteMessageMapping(
          operation.localMessageId,
          operation.remoteMessageId,
          operation.remoteChatId
        );
        break;
      case "message_delete": {
        const existing = this.record.messageRemoteByLocal[`${operation.localMessageId}`];
        if (!existing) {
          break;
        }
        delete this.record.messageRemoteByLocal[`${operation.localMessageId}`];
        delete this.record.messageLocalByRemote[existing.remoteMessageId];
        break;
      }
    }
  }

  private upsertRemoteMessageMapping(localMessageId: number, remoteMessageId: string, remoteChatId: string): void {
    const previous = this.record.messageRemoteByLocal[`${localMessageId}`];
    if (previous) {
      delete this.record.messageLocalByRemote[previous.remoteMessageId];
    }

    this.record.messageRemoteByLocal[`${localMessageId}`] = {
      remoteMessageId,
      remoteChatId
    };
    this.record.messageLocalByRemote[remoteMessageId] = localMessageId;
  }
}

export function isFeishuCompatLocalUserId(userId: string | number | null | undefined): boolean {
  const parsed = typeof userId === "number" ? userId : Number.parseInt(`${userId ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed >= FEISHU_USER_ID_BASE && parsed < FEISHU_MESSAGE_ID_BASE;
}
