import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

export const MAX_RETRIEVE_FILE_BYTES = 50 * 1024 * 1024;

export type RetrieveFileErrorCode =
  | "empty_path"
  | "project_not_found"
  | "not_found"
  | "unreadable"
  | "not_regular_file"
  | "too_large"
  | "changed";

export class RetrieveFileValidationError extends Error {
  constructor(
    readonly code: RetrieveFileErrorCode,
    message: string,
    readonly sizeBytes?: number
  ) {
    super(message);
    this.name = "RetrieveFileValidationError";
  }
}

export interface ResolvedRetrieveFile {
  requestedPath: string;
  projectRealPath: string;
  targetRealPath: string;
  fileName: string;
  sizeBytes: number;
  insideProject: boolean;
  displayPath: string;
  identity: RetrieveFileIdentity;
}

export interface RetrieveFileIdentity {
  dev: number;
  ino: number;
  mtimeMs: number;
  sizeBytes: number;
}

interface ResolveRetrieveFileOptions {
  rawPath: string;
  projectPath: string;
  homeDir: string;
}

export async function resolveRetrieveFile(
  options: ResolveRetrieveFileOptions
): Promise<ResolvedRetrieveFile> {
  const requestedPath = normalizeRequestedPath(options.rawPath);
  if (!requestedPath) {
    throw new RetrieveFileValidationError("empty_path", "请提供要取回的文件路径。");
  }

  const projectRealPath = await resolveProjectPath(options.projectPath);
  const candidatePath = resolveCandidatePath(requestedPath, projectRealPath, options.homeDir);
  const targetRealPath = await resolveTargetPath(candidatePath);

  let targetStat;
  try {
    targetStat = await stat(targetRealPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new RetrieveFileValidationError("not_found", "找不到指定的文件。");
    }
    throw new RetrieveFileValidationError("unreadable", "无法读取该文件，请检查文件权限。");
  }

  if (!targetStat.isFile()) {
    throw new RetrieveFileValidationError("not_regular_file", "指定路径不是普通文件，无法发送。");
  }

  try {
    await access(targetRealPath, constants.R_OK);
  } catch {
    throw new RetrieveFileValidationError("unreadable", "无法读取该文件，请检查文件权限。");
  }

  if (targetStat.size > MAX_RETRIEVE_FILE_BYTES) {
    throw new RetrieveFileValidationError(
      "too_large",
      `文件大小为 ${formatRetrieveFileSize(targetStat.size)}（${targetStat.size} B），超过 50 MiB 限制。`,
      targetStat.size
    );
  }

  const projectRelative = relative(projectRealPath, targetRealPath);
  const insideProject = projectRelative === ""
    || (!projectRelative.startsWith(`..${sep}`) && projectRelative !== ".." && !isAbsolute(projectRelative));

  return {
    requestedPath,
    projectRealPath,
    targetRealPath,
    fileName: basename(targetRealPath),
    sizeBytes: targetStat.size,
    insideProject,
    displayPath: insideProject ? projectRelative : targetRealPath,
    identity: {
      dev: targetStat.dev,
      ino: targetStat.ino,
      mtimeMs: targetStat.mtimeMs,
      sizeBytes: targetStat.size
    }
  };
}

export function formatRetrieveFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KiB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function normalizeRequestedPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed.at(-1);
    if ((first === "'" || first === "\"") && last === first) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

async function resolveProjectPath(projectPath: string): Promise<string> {
  try {
    return await realpath(projectPath);
  } catch {
    throw new RetrieveFileValidationError("project_not_found", "当前项目路径不存在或无法访问。");
  }
}

function resolveCandidatePath(requestedPath: string, projectRealPath: string, homeDir: string): string {
  if (requestedPath === "~") {
    return homeDir;
  }
  if (requestedPath.startsWith("~/")) {
    return resolve(homeDir, requestedPath.slice(2));
  }
  if (isAbsolute(requestedPath)) {
    return requestedPath;
  }
  return resolve(projectRealPath, requestedPath);
}

async function resolveTargetPath(candidatePath: string): Promise<string> {
  try {
    return await realpath(candidatePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new RetrieveFileValidationError("not_found", "找不到指定的文件。");
    }
    throw new RetrieveFileValidationError("unreadable", "无法读取该文件，请检查文件权限。");
  }
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}
