import type { BridgeConfig } from "../../config.js";
import type { BridgePackConfigCodec, BridgePackOptionValue } from "../catalog.js";

export interface FeishuPackConfig {
  appId: string;
  appSecret: string;
  apiBaseUrl: string;
}

export const FEISHU_PACK_DISPLAY_NAME = "Feishu";
export const FEISHU_PACK_SKILL_NAME = "feishu-codex-linker";

export const FEISHU_PACK_DEFAULT_CONFIG: FeishuPackConfig = {
  appId: "",
  appSecret: "",
  apiBaseUrl: "https://open.feishu.cn"
};

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

function applyFeishuPackOptions(
  currentConfig: FeishuPackConfig | undefined,
  options: Readonly<Record<string, BridgePackOptionValue>>
): FeishuPackConfig {
  const current = currentConfig ?? FEISHU_PACK_DEFAULT_CONFIG;
  const appId = readStringOption(options, "app-id", "appId");
  const appSecret = readStringOption(options, "app-secret", "appSecret");
  const apiBaseUrl = readStringOption(options, "api-base-url", "apiBaseUrl");

  return {
    appId: appId ?? current.appId,
    appSecret: appSecret ?? current.appSecret,
    apiBaseUrl: apiBaseUrl ?? current.apiBaseUrl
  };
}

export function getFeishuPackConfig(config: Pick<BridgeConfig, "packs">): FeishuPackConfig {
  const packConfig = config.packs?.feishu;
  if (!packConfig || typeof packConfig !== "object") {
    return { ...FEISHU_PACK_DEFAULT_CONFIG };
  }

  const value = packConfig as Partial<FeishuPackConfig>;
  return {
    appId: typeof value.appId === "string" ? value.appId : FEISHU_PACK_DEFAULT_CONFIG.appId,
    appSecret: typeof value.appSecret === "string" ? value.appSecret : FEISHU_PACK_DEFAULT_CONFIG.appSecret,
    apiBaseUrl: typeof value.apiBaseUrl === "string" ? value.apiBaseUrl : FEISHU_PACK_DEFAULT_CONFIG.apiBaseUrl
  };
}

export const FEISHU_PACK_CONFIG_CODEC: BridgePackConfigCodec<FeishuPackConfig> = {
  getDefaultConfig: () => ({ ...FEISHU_PACK_DEFAULT_CONFIG }),
  readFromEnv: (env) => ({
    appId: env.FEISHU_APP_ID ?? FEISHU_PACK_DEFAULT_CONFIG.appId,
    appSecret: env.FEISHU_APP_SECRET ?? FEISHU_PACK_DEFAULT_CONFIG.appSecret,
    apiBaseUrl: env.FEISHU_API_BASE_URL ?? FEISHU_PACK_DEFAULT_CONFIG.apiBaseUrl
  }),
  writeToEnv: (config) => ({
    FEISHU_APP_ID: config.appId,
    FEISHU_APP_SECRET: config.appSecret,
    FEISHU_API_BASE_URL: config.apiBaseUrl
  }),
  applyInstallOptions: (currentConfig, options) => applyFeishuPackOptions(currentConfig, options)
};
