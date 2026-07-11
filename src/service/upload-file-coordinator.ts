import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, link, lstat, open, readdir, realpath, rm, stat, type FileHandle } from "node:fs/promises";
import { basename, isAbsolute, join, win32 } from "node:path";

import type { TelegramDocument, TelegramFile } from "../telegram/api.js";
import type { SessionRow } from "../types.js";

const UPLOAD_TTL_MS = 5 * 60 * 1000;
export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
export const UPLOAD_TEMP_ABANDONMENT_MS = UPLOAD_TTL_MS;
const WAITING_TEXT = "Waiting for one Telegram Document. Send /cancel to stop.";
const TEMP_FILE_PATTERN = /^\.ctb-upload-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.tmp$/iu;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

interface UploadApi {
  getFile(fileId: string): Promise<TelegramFile>;
  downloadFile(fileId: string, destinationPath: string, file?: TelegramFile): Promise<string | null>;
}

interface UploadLogger {
  warn(message: string, meta?: Record<string, unknown>): Promise<void>;
}

export interface UploadFileCoordinatorDeps {
  getActiveSession(chatId: string): SessionRow | null;
  hasConflictingInput(chatId: string): boolean;
  getApi(): UploadApi | null;
  safeSendMessage(chatId: string, text: string): Promise<boolean>;
  logger: UploadLogger;
  now?: () => number;
  createUuid?: () => string;
  canonicalizeProjectRoot?: (path: string) => Promise<string>;
  afterTempValidated?: (path: string) => Promise<void>;
}

interface PendingUpload {
  chatId: string;
  sessionId: string;
  projectIdentity: string;
  projectPath: string;
  projectRoot: string;
  createdAt: number;
  expiresAt: number;
}

export class UploadFileCoordinator {
  private readonly pending = new Map<string, PendingUpload>();
  private readonly now: () => number;
  private readonly createUuid: () => string;
  private readonly canonicalizeProjectRoot: (path: string) => Promise<string>;
  private readonly queues = new Map<string, Promise<void>>();
  private readonly mutationVersions = new Map<string, number>();

  constructor(private readonly deps: UploadFileCoordinatorDeps) {
    this.now = deps.now ?? Date.now;
    this.createUuid = deps.createUuid ?? randomUUID;
    this.canonicalizeProjectRoot = deps.canonicalizeProjectRoot ?? realpath;
  }

  async begin(chatId: string): Promise<boolean> {
    return await this.enqueue(chatId, async () => await this.beginQueued(chatId));
  }

  private async beginQueued(chatId: string): Promise<boolean> {
    if (this.getPending(chatId)) {
      await this.deps.safeSendMessage(chatId, `Already waiting. ${WAITING_TEXT}`);
      return false;
    }
    if (this.deps.hasConflictingInput(chatId)) {
      return false;
    }

    const active = this.deps.getActiveSession(chatId);
    if (!isUsableSession(active)) {
      await this.deps.safeSendMessage(chatId, "No writable active project is available.");
      return false;
    }

    let projectRoot: string;
    const mutationVersion = this.mutationVersions.get(chatId) ?? 0;
    try {
      projectRoot = await this.canonicalizeProjectRoot(active.projectPath);
      const projectStats = await stat(projectRoot);
      if (!projectStats.isDirectory() || (process.platform !== "win32" && (projectStats.mode & 0o222) === 0)) {
        throw new Error("project_not_writable");
      }
      await access(projectRoot, constants.W_OK);
    } catch {
      await this.deps.safeSendMessage(chatId, "The active project is not writable.");
      return false;
    }
    if ((this.mutationVersions.get(chatId) ?? 0) !== mutationVersion) return false;

    const createdAt = this.now();
    this.pending.set(chatId, {
      chatId,
      sessionId: active.sessionId,
      projectIdentity: active.projectPath,
      projectPath: active.projectPath,
      projectRoot,
      createdAt,
      expiresAt: createdAt + UPLOAD_TTL_MS
    });
    await this.deps.safeSendMessage(
      chatId,
      `Waiting for one Document for project ${safeFilename(active.projectName)}. Send /cancel to stop; this expires in five minutes.`
    );
    return true;
  }

  cancel(chatId: string): boolean {
    this.bumpMutationVersion(chatId);
    return this.pending.delete(chatId);
  }

  isWaiting(chatId: string): boolean {
    return this.getPending(chatId) !== null;
  }

  async handleWaitingText(chatId: string): Promise<boolean> {
    return await this.enqueue(chatId, async () => {
      if (!this.getPending(chatId)) return false;
      await this.deps.safeSendMessage(chatId, WAITING_TEXT);
      return true;
    });
  }

  clearForCommand(chatId: string, command: string): boolean {
    const normalized = command.trim().split(/\s+/u, 1)[0]?.toLowerCase();
    if (normalized === "/upload" || normalized === "/cancel") return false;
    this.bumpMutationVersion(chatId);
    return this.pending.delete(chatId);
  }

  async handleDocument(chatId: string, document: TelegramDocument): Promise<boolean> {
    return await this.enqueue(chatId, async () => await this.handleDocumentQueued(chatId, document));
  }

  private async handleDocumentQueued(chatId: string, document: TelegramDocument): Promise<boolean> {
    // Claim before the first await so simultaneous updates cannot both consume it.
    const pending = this.getPending(chatId);
    if (!pending) return false;
    this.pending.delete(chatId);

    const filename = validateFilename(document.file_name);
    if (!filename) {
      await this.deps.safeSendMessage(chatId, "The Document filename is invalid.");
      return true;
    }
    if (document.file_size !== undefined && document.file_size > MAX_UPLOAD_FILE_BYTES) {
      await this.deps.safeSendMessage(chatId, "The Document is too large to upload.");
      return true;
    }

    let tempPath: string | null = null;
    let tempHandle: FileHandle | null = null;
    let linkedDestination: string | null = null;
    let publicationVerified = false;
    let savedSize: number | null = null;
    const startedAt = this.now();
    try {
      if (!await this.bindingMatches(pending)) {
        await this.deps.safeSendMessage(chatId, "The active project or session changed; nothing was saved.");
        return true;
      }
      const api = this.deps.getApi();
      if (!api) {
        await this.deps.safeSendMessage(chatId, "Telegram download is unavailable.");
        return true;
      }

      tempPath = join(pending.projectRoot, `.ctb-upload-${this.createUuid()}.tmp`);
      const file = await api.getFile(document.file_id);
      const downloaded = await api.downloadFile(document.file_id, tempPath, file);
      if (!downloaded) throw new Error("download_unavailable");
      if (downloaded !== tempPath) throw new Error("unexpected_download_path");
      tempHandle = await open(tempPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      let tempStats = await tempHandle.stat();
      if (!tempStats.isFile()) throw new Error("invalid_download_entry");
      await tempHandle.chmod(0o600);
      tempStats = await tempHandle.stat();
      if (tempStats.size > MAX_UPLOAD_FILE_BYTES) throw uploadTooLargeError();
      await this.deps.afterTempValidated?.(tempPath);

      if (!await this.bindingMatches(pending)) {
        await this.deps.safeSendMessage(chatId, "The active project or session changed; nothing was saved.");
        return true;
      }

      const destination = join(pending.projectRoot, filename);
      if (basename(destination) !== filename) throw new Error("invalid_destination");
      await assertDestinationAbsent(destination);
      await link(tempPath, destination);
      linkedDestination = destination;
      const saved = await lstat(destination);
      if (!saved.isFile() || saved.dev !== tempStats.dev || saved.ino !== tempStats.ino) {
        await rm(destination, { force: true });
        linkedDestination = null;
        throw new Error("published_inode_mismatch");
      }
      publicationVerified = true;
      savedSize = saved.size;
    } catch (error) {
      if (linkedDestination && !publicationVerified) {
        await rm(linkedDestination, { force: true }).catch(() => {});
      }
      await this.deps.logger.warn("telegram document upload failed", {
        chatId,
        sessionId: pending.sessionId,
        filename: safeFilename(filename),
        declaredBytes: document.file_size ?? null,
        durationMs: Math.max(0, this.now() - startedAt),
        outcome: classifyFailure(error)
      });
      await this.deps.safeSendMessage(chatId, failureMessage(error));
      return true;
    } finally {
      await tempHandle?.close().catch(() => {});
      if (tempPath) await rm(tempPath, { force: true }).catch(() => {});
    }

    let notificationDelivered = false;
    try {
      notificationDelivered = await this.deps.safeSendMessage(
        chatId,
        `Saved ${safeFilename(filename)} (${savedSize ?? 0} bytes) as ./${safeFilename(filename)}.`
      );
    } catch {
      // The filesystem commit is already complete; notification is best effort.
    }
    if (!notificationDelivered) {
      await this.deps.logger.warn("telegram upload success notification failed", {
        chatId,
        sessionId: pending.sessionId,
        filename: safeFilename(filename),
        actualBytes: savedSize,
        outcome: "saved_notification_failed"
      }).catch(() => {});
    }
    return true;
  }

  async cleanupStartup(projectRoots: Iterable<string>): Promise<void> {
    for (const root of projectRoots) {
      let canonical: string;
      try { canonical = await realpath(root); } catch { continue; }
      let names: string[];
      try { names = await readdir(canonical); } catch { continue; }
      for (const name of names) {
        if (!TEMP_FILE_PATTERN.test(name)) continue;
        const path = join(canonical, name);
        try {
          const entry = await lstat(path);
          // This high-entropy namespace is bridge-reserved. Fresh entries may
          // belong to an in-flight upload and are never startup-cleaned.
          if (entry.isFile() && this.now() - entry.mtimeMs >= UPLOAD_TEMP_ABANDONMENT_MS) {
            await rm(path);
          }
        } catch {
          // Best-effort recovery must not prevent startup.
        }
      }
    }
  }

  private getPending(chatId: string): PendingUpload | null {
    const pending = this.pending.get(chatId) ?? null;
    if (pending && this.now() >= pending.expiresAt) {
      this.pending.delete(chatId);
      return null;
    }
    return pending;
  }

  private async bindingMatches(pending: PendingUpload): Promise<boolean> {
    const active = this.deps.getActiveSession(pending.chatId);
    if (!isUsableSession(active)
      || active.sessionId !== pending.sessionId
      || active.projectPath !== pending.projectIdentity
      || active.projectPath !== pending.projectPath) return false;
    try {
      return await this.canonicalizeProjectRoot(active.projectPath) === pending.projectRoot;
    } catch {
      return false;
    }
  }

  private bumpMutationVersion(chatId: string): void {
    this.mutationVersions.set(chatId, (this.mutationVersions.get(chatId) ?? 0) + 1);
  }

  private enqueue<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(chatId) ?? Promise.resolve();
    const result = previous.catch(() => {}).then(operation);
    const tail = result.then(() => {}, () => {});
    this.queues.set(chatId, tail);
    void tail.finally(() => {
      if (this.queues.get(chatId) === tail) this.queues.delete(chatId);
    });
    return result;
  }
}

function isUsableSession(session: SessionRow | null): session is SessionRow {
  return session !== null
    && !session.archived
    && (session.sessionKind === "regular" || session.sessionKind === "side");
}

export function validateUploadFilename(raw: string | undefined): string | null {
  return validateFilename(raw);
}

function validateFilename(raw: string | undefined): string | null {
  if (!raw || raw === "." || raw === "..") return null;
  if (/[\0\r\n/\\]/u.test(raw) || /[\u0001-\u001f\u007f]/u.test(raw)) return null;
  if (isAbsolute(raw) || win32.isAbsolute(raw) || win32.parse(raw).root || /^[a-z]:/iu.test(raw)) return null;
  if (basename(raw) !== raw || raw.endsWith(".") || raw.endsWith(" ")) return null;
  if (WINDOWS_RESERVED_NAME.test(raw)) return null;
  if (/[:<>"|?*]/u.test(raw)) return null;
  return raw;
}

function safeFilename(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/gu, "?").slice(0, 255);
}

function classifyFailure(error: unknown): string {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === "EEXIST" ? "destination_exists" : code === "EFBIG" ? "unsupported_size" : "failed";
}

function failureMessage(error: unknown): string {
  if ((error as NodeJS.ErrnoException)?.code === "EFBIG") return "The Document is too large to upload.";
  return (error as NodeJS.ErrnoException)?.code === "EEXIST"
    ? "A file or directory with that name already exists."
    : "The Document could not be saved.";
}

function uploadTooLargeError(): NodeJS.ErrnoException {
  const error = new Error("unsupported_size") as NodeJS.ErrnoException;
  error.code = "EFBIG";
  return error;
}

async function assertDestinationAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
    const error = new Error("destination_exists") as NodeJS.ErrnoException;
    error.code = "EEXIST";
    throw error;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}
