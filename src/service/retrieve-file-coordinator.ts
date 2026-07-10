import { randomBytes } from "node:crypto";

import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import {
  encodeRetrieveCancelCallback,
  encodeRetrieveConfirmCallback
} from "../telegram/ui.js";
import type { SessionRow } from "../types.js";
import {
  formatRetrieveFileSize,
  resolveRetrieveFile,
  RetrieveFileValidationError,
  type ResolvedRetrieveFile
} from "./retrieve-file-policy.js";

const RETRIEVE_CAPTION_LIMIT = 900;
const CONFIRMATION_TTL_MS = 120_000;

interface RetrieveSessionStore {
  getActiveSession(chatId: string): SessionRow | null;
}

export interface RetrieveFileCoordinatorDeps {
  homeDir: string;
  logger: {
    warn(message: string, meta?: Record<string, unknown>): Promise<void>;
  };
  getStore(): RetrieveSessionStore | null;
  safeSendMessage(
    chatId: string,
    text: string,
    replyMarkup?: TelegramInlineKeyboardMarkup
  ): Promise<boolean>;
  sendDocument(
    chatId: string,
    filePath: string,
    options: { caption: string; fileName: string }
  ): Promise<boolean>;
  resolveFile?: typeof resolveRetrieveFile;
  now?: () => number;
  createToken?: () => string;
}

interface PendingRetrieveConfirmation {
  chatId: string;
  sessionId: string;
  projectPath: string;
  projectRealPath: string;
  requestedPath: string;
  targetRealPath: string;
  expiresAt: number;
}

export class RetrieveFileCoordinator {
  private readonly pendingByToken = new Map<string, PendingRetrieveConfirmation>();
  private readonly resolveFile: typeof resolveRetrieveFile;
  private readonly now: () => number;
  private readonly createToken: () => string;

  constructor(private readonly deps: RetrieveFileCoordinatorDeps) {
    this.resolveFile = deps.resolveFile ?? resolveRetrieveFile;
    this.now = deps.now ?? Date.now;
    this.createToken = deps.createToken ?? (() => randomBytes(9).toString("base64url"));
  }

  async handleCommand(chatId: string, rawPath: string): Promise<void> {
    this.pruneExpiredConfirmations();
    const session = this.deps.getStore()?.getActiveSession(chatId) ?? null;
    if (!session || session.archived) {
      await this.deps.safeSendMessage(chatId, "请先发送 /new 选择项目。");
      return;
    }

    try {
      const resolved = await this.resolveFile({
        rawPath,
        projectPath: session.projectPath,
        homeDir: this.deps.homeDir
      });
      if (!resolved.insideProject) {
        await this.requestConfirmation(chatId, session, resolved);
        return;
      }
      const delivered = await this.sendResolvedDocument(chatId, resolved);
      if (!delivered) {
        await this.deps.safeSendMessage(chatId, "文件上传失败，请稍后重试。");
      }
    } catch (error) {
      if (error instanceof RetrieveFileValidationError) {
        await this.deps.safeSendMessage(chatId, error.message);
        return;
      }
      await this.deps.logger.warn("retrieve file command failed", {
        chatId,
        error: String(error)
      });
      await this.deps.safeSendMessage(chatId, "文件取回失败，请稍后重试。");
    }
  }

  async handleDecision(chatId: string, token: string, approved: boolean): Promise<string> {
    const pending = this.pendingByToken.get(token);
    this.pendingByToken.delete(token);
    this.pruneExpiredConfirmations();

    if (!pending || pending.chatId !== chatId) {
      return "这个确认已失效。";
    }
    if (this.now() > pending.expiresAt) {
      return "这个确认已过期。";
    }
    if (!approved) {
      return "已取消。";
    }

    const session = this.deps.getStore()?.getActiveSession(chatId) ?? null;
    if (
      !session
      || session.archived
      || session.sessionId !== pending.sessionId
      || session.projectPath !== pending.projectPath
    ) {
      return "当前会话或项目已改变，未发送文件。";
    }

    try {
      const resolved = await this.resolveFile({
        rawPath: pending.requestedPath,
        projectPath: session.projectPath,
        homeDir: this.deps.homeDir
      });
      if (resolved.projectRealPath !== pending.projectRealPath) {
        return "当前会话或项目已改变，未发送文件。";
      }
      if (resolved.targetRealPath !== pending.targetRealPath) {
        return "文件路径已改变，请重新使用 /retrieve。";
      }

      const delivered = await this.sendResolvedDocument(chatId, resolved);
      return delivered ? "文件已发送。" : "文件上传失败，请稍后重试。";
    } catch (error) {
      if (error instanceof RetrieveFileValidationError) {
        return error.message;
      }
      await this.deps.logger.warn("retrieve file approval failed", {
        chatId,
        error: String(error)
      });
      return "文件取回失败，请稍后重试。";
    }
  }

  private async requestConfirmation(
    chatId: string,
    session: SessionRow,
    resolved: ResolvedRetrieveFile
  ): Promise<void> {
    for (const [pendingToken, pending] of this.pendingByToken) {
      if (pending.chatId === chatId && pending.sessionId === session.sessionId) {
        this.pendingByToken.delete(pendingToken);
      }
    }

    const token = this.createToken();
    this.pendingByToken.set(token, {
      chatId,
      sessionId: session.sessionId,
      projectPath: session.projectPath,
      projectRealPath: resolved.projectRealPath,
      requestedPath: resolved.requestedPath,
      targetRealPath: resolved.targetRealPath,
      expiresAt: this.now() + CONFIRMATION_TTL_MS
    });

    const delivered = await this.deps.safeSendMessage(
      chatId,
      [
        "⚠️ 此文件位于当前项目外，需要确认。",
        `文件：${resolved.targetRealPath}`,
        `大小：${formatRetrieveFileSize(resolved.sizeBytes)}`,
        `当前项目：${session.projectPath}`
      ].join("\n"),
      buildConfirmationReplyMarkup(token)
    );
    if (!delivered) {
      this.pendingByToken.delete(token);
    }
  }

  private async sendResolvedDocument(chatId: string, resolved: ResolvedRetrieveFile): Promise<boolean> {
    return await this.deps.sendDocument(chatId, resolved.targetRealPath, {
      fileName: resolved.fileName,
      caption: buildRetrieveCaption(resolved.displayPath, resolved.sizeBytes)
    });
  }

  private pruneExpiredConfirmations(): void {
    const now = this.now();
    for (const [token, pending] of this.pendingByToken) {
      if (now > pending.expiresAt) {
        this.pendingByToken.delete(token);
      }
    }
  }
}

function buildConfirmationReplyMarkup(token: string): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      {
        text: "确认发送",
        callback_data: encodeRetrieveConfirmCallback(token),
        style: "primary"
      },
      { text: "取消", callback_data: encodeRetrieveCancelCallback(token) }
    ]]
  };
}

function buildRetrieveCaption(displayPath: string, sizeBytes: number): string {
  const prefix = "Retrieved: ";
  const suffix = `\nSize: ${formatRetrieveFileSize(sizeBytes)}`;
  const pathLimit = RETRIEVE_CAPTION_LIMIT - prefix.length - suffix.length;
  const boundedPath = displayPath.length <= pathLimit
    ? displayPath
    : `…${displayPath.slice(-(pathLimit - 1))}`;
  return `${prefix}${boundedPath}${suffix}`;
}
