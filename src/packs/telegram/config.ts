import type { BridgeConfig } from "../../config.js";
import type { BridgePackConfigCodec, BridgePackOptionValue } from "../catalog.js";

export interface TelegramPackConfig {
  botToken: string;
  apiBaseUrl: string;
  pollTimeoutSeconds: number;
  pollIntervalMs: number;
}

export const TELEGRAM_PACK_DISPLAY_NAME = "Telegram";
export const TELEGRAM_PACK_SKILL_NAME = "telegram-codex-linker";

export const TELEGRAM_PACK_DEFAULT_CONFIG: TelegramPackConfig = {
  botToken: "",
  apiBaseUrl: "https://api.telegram.org",
  pollTimeoutSeconds: 20,
  pollIntervalMs: 1500
};

const TELEGRAM_PACK_OPTION_ALIASES: Readonly<Record<string, keyof TelegramPackConfig>> = {
  token: "botToken",
  "bot-token": "botToken",
  botToken: "botToken",
  apiBaseUrl: "apiBaseUrl",
  "api-base-url": "apiBaseUrl",
  pollTimeoutSeconds: "pollTimeoutSeconds",
  "poll-timeout-seconds": "pollTimeoutSeconds",
  pollIntervalMs: "pollIntervalMs",
  "poll-interval-ms": "pollIntervalMs"
};

function readNumericOption(
  options: Readonly<Record<string, BridgePackOptionValue>>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = options[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function readStringOption(
  options: Readonly<Record<string, BridgePackOptionValue>>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = options[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

function applyTelegramPackOptions(
  currentConfig: TelegramPackConfig | undefined,
  options: Readonly<Record<string, BridgePackOptionValue>>
): TelegramPackConfig {
  const current = currentConfig ?? TELEGRAM_PACK_DEFAULT_CONFIG;
  const botToken = readStringOption(options, "bot-token", "token", "botToken");
  const apiBaseUrl = readStringOption(options, "api-base-url", "apiBaseUrl");
  const pollTimeoutSeconds = readNumericOption(options, "poll-timeout-seconds", "pollTimeoutSeconds");
  const pollIntervalMs = readNumericOption(options, "poll-interval-ms", "pollIntervalMs");

  return {
    botToken: botToken ?? current.botToken,
    apiBaseUrl: apiBaseUrl ?? current.apiBaseUrl,
    pollTimeoutSeconds: pollTimeoutSeconds ?? current.pollTimeoutSeconds,
    pollIntervalMs: pollIntervalMs ?? current.pollIntervalMs
  };
}

export function getTelegramPackConfig(config: Pick<BridgeConfig, "packs">): TelegramPackConfig {
  const packConfig = config.packs?.telegram;
  if (!packConfig || typeof packConfig !== "object") {
    return { ...TELEGRAM_PACK_DEFAULT_CONFIG };
  }

  const value = packConfig as Partial<TelegramPackConfig>;
  return {
    botToken: typeof value.botToken === "string" ? value.botToken : TELEGRAM_PACK_DEFAULT_CONFIG.botToken,
    apiBaseUrl: typeof value.apiBaseUrl === "string" ? value.apiBaseUrl : TELEGRAM_PACK_DEFAULT_CONFIG.apiBaseUrl,
    pollTimeoutSeconds: typeof value.pollTimeoutSeconds === "number"
      ? value.pollTimeoutSeconds
      : TELEGRAM_PACK_DEFAULT_CONFIG.pollTimeoutSeconds,
    pollIntervalMs: typeof value.pollIntervalMs === "number"
      ? value.pollIntervalMs
      : TELEGRAM_PACK_DEFAULT_CONFIG.pollIntervalMs
  };
}

export function listTelegramPackOptionKeys(): string[] {
  return Object.keys(TELEGRAM_PACK_OPTION_ALIASES);
}

export const TELEGRAM_PACK_CONFIG_CODEC: BridgePackConfigCodec<TelegramPackConfig> = {
  getDefaultConfig: () => ({ ...TELEGRAM_PACK_DEFAULT_CONFIG }),
  readFromEnv: (env) => ({
    botToken: env.TELEGRAM_BOT_TOKEN ?? TELEGRAM_PACK_DEFAULT_CONFIG.botToken,
    apiBaseUrl: env.TELEGRAM_API_BASE_URL ?? TELEGRAM_PACK_DEFAULT_CONFIG.apiBaseUrl,
    pollTimeoutSeconds: Number.parseInt(
      env.TELEGRAM_POLL_TIMEOUT_SECONDS ?? `${TELEGRAM_PACK_DEFAULT_CONFIG.pollTimeoutSeconds}`,
      10
    ),
    pollIntervalMs: Number.parseInt(
      env.TELEGRAM_POLL_INTERVAL_MS ?? `${TELEGRAM_PACK_DEFAULT_CONFIG.pollIntervalMs}`,
      10
    )
  }),
  writeToEnv: (config) => ({
    TELEGRAM_BOT_TOKEN: config.botToken,
    TELEGRAM_API_BASE_URL: config.apiBaseUrl,
    TELEGRAM_POLL_TIMEOUT_SECONDS: `${config.pollTimeoutSeconds}`,
    TELEGRAM_POLL_INTERVAL_MS: `${config.pollIntervalMs}`
  }),
  applyInstallOptions: (currentConfig, options) => applyTelegramPackOptions(currentConfig, options)
};
