import { randomBytes } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { mkdtemp, open, rm, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TelegramInlineKeyboardMarkup } from "../telegram/api.js";
import {
  encodeRetrieveCancelCallback,
  encodeRetrieveConfirmCallback
} from "../telegram/ui.js";
import type { SessionRow } from "../types.js";
import {
  formatRetrieveFileSize,
  MAX_RETRIEVE_FILE_BYTES,
  resolveRetrieveFile,
  RetrieveFileValidationError,
  type ResolvedRetrieveFile
} from "./retrieve-file-policy.js";

const RETRIEVE_CAPTION_LIMIT = 900;
const RETRIEVE_WARNING_LIMIT = 4_000;
const WARNING_PATH_LIMIT = 1_900;
const CONFIRMATION_TTL_MS = 120_000;
const SNAPSHOT_CHUNK_BYTES = 64 * 1024;

interface RetrieveTimerHandle {
  unref?(): void;
}

interface RetrieveFileSnapshot {
  filePath: string;
  sizeBytes: number;
  cleanup(): Promise<void>;
}

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
  createSnapshot?: (resolved: ResolvedRetrieveFile) => Promise<RetrieveFileSnapshot>;
  now?: () => number;
  createToken?: () => string;
  scheduleTimer?: (callback: () => void, delayMs: number) => RetrieveTimerHandle;
  clearTimer?: (timer: RetrieveTimerHandle) => void;
}

interface PendingRetrieveConfirmation {
  chatId: string;
  sessionId: string;
  projectPath: string;
  projectRealPath: string;
  requestedPath: string;
  targetRealPath: string;
  expiresAt: number;
  timer: RetrieveTimerHandle;
}

export class RetrieveFileCoordinator {
  private readonly pendingByToken = new Map<string, PendingRetrieveConfirmation>();
  private readonly resolveFile: typeof resolveRetrieveFile;
  private readonly createSnapshot: (resolved: ResolvedRetrieveFile) => Promise<RetrieveFileSnapshot>;
  private readonly now: () => number;
  private readonly createToken: () => string;
  private readonly scheduleTimer: (callback: () => void, delayMs: number) => RetrieveTimerHandle;
  private readonly clearTimer: (timer: RetrieveTimerHandle) => void;

  constructor(private readonly deps: RetrieveFileCoordinatorDeps) {
    this.resolveFile = deps.resolveFile ?? resolveRetrieveFile;
    this.createSnapshot = deps.createSnapshot ?? createRetrieveFileSnapshot;
    this.now = deps.now ?? Date.now;
    this.createToken = deps.createToken ?? (() => randomBytes(9).toString("base64url"));
    this.scheduleTimer = deps.scheduleTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = deps.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
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
    const pending = this.takePending(token);
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
        this.deletePending(pendingToken);
      }
    }

    const token = this.createToken();
    this.deletePending(token);
    const timer = this.scheduleTimer(() => {
      this.pendingByToken.delete(token);
    }, CONFIRMATION_TTL_MS);
    timer.unref?.();
    this.pendingByToken.set(token, {
      chatId,
      sessionId: session.sessionId,
      projectPath: session.projectPath,
      projectRealPath: resolved.projectRealPath,
      requestedPath: resolved.requestedPath,
      targetRealPath: resolved.targetRealPath,
      expiresAt: this.now() + CONFIRMATION_TTL_MS,
      timer
    });

    const delivered = await this.deps.safeSendMessage(
      chatId,
      buildExternalWarning(resolved, session.projectPath),
      buildConfirmationReplyMarkup(token)
    );
    if (!delivered) {
      this.deletePending(token);
    }
  }

  private async sendResolvedDocument(chatId: string, resolved: ResolvedRetrieveFile): Promise<boolean> {
    const snapshot = await this.createSnapshot(resolved);
    try {
      return await this.deps.sendDocument(chatId, snapshot.filePath, {
        fileName: resolved.fileName,
        caption: buildRetrieveCaption(resolved.displayPath, snapshot.sizeBytes)
      });
    } finally {
      await snapshot.cleanup();
    }
  }

  private pruneExpiredConfirmations(): void {
    const now = this.now();
    for (const [token, pending] of this.pendingByToken) {
      if (now > pending.expiresAt) {
        this.deletePending(token);
      }
    }
  }

  private takePending(token: string): PendingRetrieveConfirmation | undefined {
    const pending = this.pendingByToken.get(token);
    if (pending) {
      this.pendingByToken.delete(token);
      this.clearTimer(pending.timer);
    }
    return pending;
  }

  private deletePending(token: string): void {
    const pending = this.pendingByToken.get(token);
    if (!pending) {
      return;
    }
    this.pendingByToken.delete(token);
    this.clearTimer(pending.timer);
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

function buildExternalWarning(resolved: ResolvedRetrieveFile, projectPath: string): string {
  const warning = [
    "⚠️ 此文件位于当前项目外，需要确认。",
    `文件：${truncatePathTail(resolved.targetRealPath, WARNING_PATH_LIMIT)}`,
    `大小：${formatRetrieveFileSize(resolved.sizeBytes)}`,
    `当前项目：${truncatePathTail(projectPath, WARNING_PATH_LIMIT)}`
  ].join("\n");
  return warning.slice(0, RETRIEVE_WARNING_LIMIT);
}

function truncatePathTail(path: string, limit: number): string {
  return path.length <= limit ? path : `…${path.slice(-(limit - 1))}`;
}

async function createRetrieveFileSnapshot(
  resolved: ResolvedRetrieveFile
): Promise<RetrieveFileSnapshot> {
  const stagingRoot = await mkdtemp(join(tmpdir(), "ctb-retrieve-snapshot-"));
  const stagedPath = join(stagingRoot, "file");
  try {
    const source = await openSnapshotSource(resolved.targetRealPath);
    try {
      const before = await source.stat();
      validateSnapshotIdentity(resolved, before);
      const staged = await open(stagedPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
      try {
        const copiedBytes = await copySnapshotBounded(source, staged);
        const after = await source.stat();
        validateSnapshotIdentity(resolved, after);
        if (copiedBytes !== resolved.identity.sizeBytes) {
          throw changedFileError();
        }
      } finally {
        await staged.close();
      }
    } finally {
      await source.close();
    }

    return {
      filePath: stagedPath,
      sizeBytes: resolved.identity.sizeBytes,
      cleanup: async () => {
        await rm(stagingRoot, { recursive: true, force: true });
      }
    };
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw normalizeSnapshotError(error);
  }
}

async function openSnapshotSource(filePath: string): Promise<FileHandle> {
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  try {
    return await open(filePath, constants.O_RDONLY | noFollow);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (noFollow !== 0 && (code === "EINVAL" || code === "ENOTSUP" || code === "ENOSYS")) {
      return await open(filePath, constants.O_RDONLY);
    }
    throw error;
  }
}

function validateSnapshotIdentity(
  resolved: ResolvedRetrieveFile,
  fileStat: Stats
): void {
  if (!fileStat.isFile()) {
    throw new RetrieveFileValidationError("not_regular_file", "指定路径不是普通文件，无法发送。");
  }
  if (fileStat.size > MAX_RETRIEVE_FILE_BYTES) {
    throw tooLargeError(fileStat.size);
  }
  const identity = resolved.identity;
  if (
    fileStat.dev !== identity.dev
    || fileStat.ino !== identity.ino
    || fileStat.mtimeMs !== identity.mtimeMs
    || fileStat.size !== identity.sizeBytes
  ) {
    throw changedFileError();
  }
}

async function copySnapshotBounded(source: FileHandle, target: FileHandle): Promise<number> {
  const buffer = Buffer.allocUnsafe(SNAPSHOT_CHUNK_BYTES);
  let total = 0;
  while (total <= MAX_RETRIEVE_FILE_BYTES) {
    const remaining = MAX_RETRIEVE_FILE_BYTES + 1 - total;
    const requestedBytes = Math.min(buffer.length, remaining);
    const { bytesRead } = await source.read(buffer, 0, requestedBytes, null);
    if (bytesRead === 0) {
      return total;
    }
    total += bytesRead;
    if (total > MAX_RETRIEVE_FILE_BYTES) {
      throw tooLargeError(total);
    }
    let written = 0;
    while (written < bytesRead) {
      const result = await target.write(buffer, written, bytesRead - written, null);
      written += result.bytesWritten;
    }
  }
  throw tooLargeError(total);
}

function normalizeSnapshotError(error: unknown): unknown {
  if (error instanceof RetrieveFileValidationError) {
    return error;
  }
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR" || code === "ELOOP") {
    return changedFileError();
  }
  if (code === "EACCES" || code === "EPERM") {
    return new RetrieveFileValidationError("unreadable", "无法读取该文件，请检查文件权限。");
  }
  return error;
}

function changedFileError(): RetrieveFileValidationError {
  return new RetrieveFileValidationError("changed", "文件路径已改变，请重新使用 /retrieve。");
}

function tooLargeError(sizeBytes: number): RetrieveFileValidationError {
  return new RetrieveFileValidationError(
    "too_large",
    `文件大小为 ${formatRetrieveFileSize(sizeBytes)}（${sizeBytes} B），超过 50 MiB 限制。`,
    sizeBytes
  );
}
