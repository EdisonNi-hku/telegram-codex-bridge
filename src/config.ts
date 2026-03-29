import { readFile, writeFile } from "node:fs/promises";
import { delimiter } from "node:path";

import { getHostPlatform } from "./platform.js";
import type { BridgePaths } from "./paths.js";
import { parseBooleanLike } from "./util/boolean.js";
import { expandHomePath, normalizeComparablePath } from "./util/path.js";

export interface BridgeConfig {
  telegramBotToken: string;
  codexBin: string;
  telegramApiBaseUrl: string;
  telegramPollTimeoutSeconds: number;
  telegramPollIntervalMs: number;
  projectScanRoots: string[];
  voiceInputEnabled: boolean;
  voiceOpenaiApiKey: string;
  voiceOpenaiTranscribeModel: string;
  voiceFfmpegBin: string;
  perfMonitorEnabled: boolean;
  perfMonitorSampleIntervalMs: number;
  perfMonitorRetentionDays: number;
  appServerGuardEnabled?: boolean;
  appServerGuardSampleIntervalMs?: number;
  appServerGuardMcpWorkerThreshold?: number;
  appServerGuardConsecutiveWindows?: number;
  appServerGuardCooldownMs?: number;
}

const DEFAULT_CONFIG = {
  codexBin: "codex",
  telegramApiBaseUrl: "https://api.telegram.org",
  telegramPollTimeoutSeconds: 20,
  telegramPollIntervalMs: 1500,
  projectScanRoots: [],
  voiceInputEnabled: false,
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
} as const;

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return parseBooleanLike(value) ?? fallback;
}

function parseEnvFile(content: string): Record<string, string> {
  const entries = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator === -1) {
        return null;
      }

      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  return Object.fromEntries(entries);
}

export function parseProjectScanRootsValue(value: string | undefined, homeDir: string): string[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const roots: string[] = [];
  const hostPlatform = getHostPlatform();

  for (const entry of value.split(delimiter).map((part) => part.trim()).filter((part) => part.length > 0)) {
    const resolved = expandHomePath(entry, homeDir);
    const comparable = normalizeComparablePath(resolved, hostPlatform);
    if (seen.has(comparable)) {
      continue;
    }

    seen.add(comparable);
    roots.push(resolved);
  }

  return roots;
}

export function serializeProjectScanRoots(roots: string[]): string {
  return roots.join(delimiter);
}

export async function loadConfig(paths: BridgePaths): Promise<BridgeConfig> {
  let envFile: Record<string, string> = {};

  try {
    envFile = parseEnvFile(await readFile(paths.envPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const merged = {
    ...process.env,
    ...envFile
  };

  return {
    telegramBotToken: merged.TELEGRAM_BOT_TOKEN ?? "",
    codexBin: merged.CODEX_BIN ?? DEFAULT_CONFIG.codexBin,
    telegramApiBaseUrl: merged.TELEGRAM_API_BASE_URL ?? DEFAULT_CONFIG.telegramApiBaseUrl,
    telegramPollTimeoutSeconds: Number.parseInt(
      merged.TELEGRAM_POLL_TIMEOUT_SECONDS ?? `${DEFAULT_CONFIG.telegramPollTimeoutSeconds}`,
      10
    ),
    telegramPollIntervalMs: Number.parseInt(
      merged.TELEGRAM_POLL_INTERVAL_MS ?? `${DEFAULT_CONFIG.telegramPollIntervalMs}`,
      10
    ),
    projectScanRoots: parseProjectScanRootsValue(merged.PROJECT_SCAN_ROOTS, paths.homeDir),
    voiceInputEnabled: parseBooleanEnv(merged.VOICE_INPUT_ENABLED, DEFAULT_CONFIG.voiceInputEnabled),
    voiceOpenaiApiKey: merged.VOICE_OPENAI_API_KEY ?? "",
    voiceOpenaiTranscribeModel: merged.VOICE_OPENAI_TRANSCRIBE_MODEL ?? DEFAULT_CONFIG.voiceOpenaiTranscribeModel,
    voiceFfmpegBin: merged.VOICE_FFMPEG_BIN ?? DEFAULT_CONFIG.voiceFfmpegBin,
    perfMonitorEnabled: parseBooleanEnv(merged.PERF_MONITOR_ENABLED, DEFAULT_CONFIG.perfMonitorEnabled),
    perfMonitorSampleIntervalMs: Number.parseInt(
      merged.PERF_MONITOR_SAMPLE_INTERVAL_MS ?? `${DEFAULT_CONFIG.perfMonitorSampleIntervalMs}`,
      10
    ),
    perfMonitorRetentionDays: Number.parseInt(
      merged.PERF_MONITOR_RETENTION_DAYS ?? `${DEFAULT_CONFIG.perfMonitorRetentionDays}`,
      10
    ),
    appServerGuardEnabled: parseBooleanEnv(merged.APP_SERVER_GUARD_ENABLED, DEFAULT_CONFIG.appServerGuardEnabled),
    appServerGuardSampleIntervalMs: Number.parseInt(
      merged.APP_SERVER_GUARD_SAMPLE_INTERVAL_MS ?? `${DEFAULT_CONFIG.appServerGuardSampleIntervalMs}`,
      10
    ),
    appServerGuardMcpWorkerThreshold: Number.parseInt(
      merged.APP_SERVER_GUARD_MCP_WORKER_THRESHOLD ?? `${DEFAULT_CONFIG.appServerGuardMcpWorkerThreshold}`,
      10
    ),
    appServerGuardConsecutiveWindows: Number.parseInt(
      merged.APP_SERVER_GUARD_CONSECUTIVE_WINDOWS ?? `${DEFAULT_CONFIG.appServerGuardConsecutiveWindows}`,
      10
    ),
    appServerGuardCooldownMs: Number.parseInt(
      merged.APP_SERVER_GUARD_COOLDOWN_MS ?? `${DEFAULT_CONFIG.appServerGuardCooldownMs}`,
      10
    )
  };
}

export async function writeConfig(paths: BridgePaths, config: BridgeConfig): Promise<void> {
  const content = [
    `TELEGRAM_BOT_TOKEN=${config.telegramBotToken}`,
    `CODEX_BIN=${config.codexBin}`,
    `TELEGRAM_API_BASE_URL=${config.telegramApiBaseUrl}`,
    `TELEGRAM_POLL_TIMEOUT_SECONDS=${config.telegramPollTimeoutSeconds}`,
    `TELEGRAM_POLL_INTERVAL_MS=${config.telegramPollIntervalMs}`,
    `PROJECT_SCAN_ROOTS=${serializeProjectScanRoots(config.projectScanRoots)}`,
    `VOICE_INPUT_ENABLED=${config.voiceInputEnabled ? "1" : "0"}`,
    `VOICE_OPENAI_API_KEY=${config.voiceOpenaiApiKey}`,
    `VOICE_OPENAI_TRANSCRIBE_MODEL=${config.voiceOpenaiTranscribeModel}`,
    `VOICE_FFMPEG_BIN=${config.voiceFfmpegBin}`,
    `PERF_MONITOR_ENABLED=${config.perfMonitorEnabled ? "1" : "0"}`,
    `PERF_MONITOR_SAMPLE_INTERVAL_MS=${config.perfMonitorSampleIntervalMs}`,
    `PERF_MONITOR_RETENTION_DAYS=${config.perfMonitorRetentionDays}`,
    `APP_SERVER_GUARD_ENABLED=${(config.appServerGuardEnabled ?? DEFAULT_CONFIG.appServerGuardEnabled) ? "1" : "0"}`,
    `APP_SERVER_GUARD_SAMPLE_INTERVAL_MS=${config.appServerGuardSampleIntervalMs ?? DEFAULT_CONFIG.appServerGuardSampleIntervalMs}`,
    `APP_SERVER_GUARD_MCP_WORKER_THRESHOLD=${config.appServerGuardMcpWorkerThreshold ?? DEFAULT_CONFIG.appServerGuardMcpWorkerThreshold}`,
    `APP_SERVER_GUARD_CONSECUTIVE_WINDOWS=${config.appServerGuardConsecutiveWindows ?? DEFAULT_CONFIG.appServerGuardConsecutiveWindows}`,
    `APP_SERVER_GUARD_COOLDOWN_MS=${config.appServerGuardCooldownMs ?? DEFAULT_CONFIG.appServerGuardCooldownMs}`
  ].join("\n");

  await writeFile(paths.envPath, `${content}\n`, "utf8");
}

export function withInstallOverrides(
  current: BridgeConfig,
  overrides: Partial<BridgeConfig>
): BridgeConfig {
  return {
    telegramBotToken: overrides.telegramBotToken ?? current.telegramBotToken,
    codexBin: overrides.codexBin ?? current.codexBin,
    telegramApiBaseUrl: overrides.telegramApiBaseUrl ?? current.telegramApiBaseUrl,
    telegramPollTimeoutSeconds: overrides.telegramPollTimeoutSeconds ?? current.telegramPollTimeoutSeconds,
    telegramPollIntervalMs: overrides.telegramPollIntervalMs ?? current.telegramPollIntervalMs,
    projectScanRoots: overrides.projectScanRoots ?? current.projectScanRoots,
    voiceInputEnabled: overrides.voiceInputEnabled ?? current.voiceInputEnabled,
    voiceOpenaiApiKey: overrides.voiceOpenaiApiKey ?? current.voiceOpenaiApiKey,
    voiceOpenaiTranscribeModel: overrides.voiceOpenaiTranscribeModel ?? current.voiceOpenaiTranscribeModel,
    voiceFfmpegBin: overrides.voiceFfmpegBin ?? current.voiceFfmpegBin,
    perfMonitorEnabled: overrides.perfMonitorEnabled ?? current.perfMonitorEnabled,
    perfMonitorSampleIntervalMs: overrides.perfMonitorSampleIntervalMs ?? current.perfMonitorSampleIntervalMs,
    perfMonitorRetentionDays: overrides.perfMonitorRetentionDays ?? current.perfMonitorRetentionDays,
    appServerGuardEnabled: overrides.appServerGuardEnabled ?? current.appServerGuardEnabled ?? DEFAULT_CONFIG.appServerGuardEnabled,
    appServerGuardSampleIntervalMs: overrides.appServerGuardSampleIntervalMs
      ?? current.appServerGuardSampleIntervalMs
      ?? DEFAULT_CONFIG.appServerGuardSampleIntervalMs,
    appServerGuardMcpWorkerThreshold: overrides.appServerGuardMcpWorkerThreshold
      ?? current.appServerGuardMcpWorkerThreshold
      ?? DEFAULT_CONFIG.appServerGuardMcpWorkerThreshold,
    appServerGuardConsecutiveWindows: overrides.appServerGuardConsecutiveWindows
      ?? current.appServerGuardConsecutiveWindows
      ?? DEFAULT_CONFIG.appServerGuardConsecutiveWindows,
    appServerGuardCooldownMs: overrides.appServerGuardCooldownMs
      ?? current.appServerGuardCooldownMs
      ?? DEFAULT_CONFIG.appServerGuardCooldownMs
  };
}
