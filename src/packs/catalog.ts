import { DEFAULT_BRIDGE_PACK, isBridgePackName, SUPPORTED_BRIDGE_PACKS, type BridgePackName } from "./names.js";
import { FEISHU_PACK_CONFIG_CODEC, FEISHU_PACK_DISPLAY_NAME, FEISHU_PACK_SKILL_NAME } from "./feishu/config.js";
import { TELEGRAM_PACK_CONFIG_CODEC, TELEGRAM_PACK_DISPLAY_NAME, TELEGRAM_PACK_SKILL_NAME } from "./telegram/config.js";

export type BridgePackOptionValue = string | number | boolean | undefined;

export interface BridgePackConfigCodec<PackConfig = unknown> {
  getDefaultConfig(): PackConfig;
  readFromEnv(env: NodeJS.ProcessEnv, homeDir: string): PackConfig;
  writeToEnv(config: PackConfig): Record<string, string>;
  applyInstallOptions(
    currentConfig: PackConfig | undefined,
    options: Readonly<Record<string, BridgePackOptionValue>>
  ): PackConfig;
}

export interface BridgePackCatalogEntry<PackConfig = unknown> {
  name: BridgePackName;
  displayName: string;
  skillName: string;
  configCodec: BridgePackConfigCodec<PackConfig>;
}

const PACK_CATALOG: Record<BridgePackName, BridgePackCatalogEntry> = {
  feishu: {
    name: "feishu",
    displayName: FEISHU_PACK_DISPLAY_NAME,
    skillName: FEISHU_PACK_SKILL_NAME,
    configCodec: FEISHU_PACK_CONFIG_CODEC
  },
  telegram: {
    name: "telegram",
    displayName: TELEGRAM_PACK_DISPLAY_NAME,
    skillName: TELEGRAM_PACK_SKILL_NAME,
    configCodec: TELEGRAM_PACK_CONFIG_CODEC
  }
};

export function listSupportedBridgePacks(): BridgePackName[] {
  return [...SUPPORTED_BRIDGE_PACKS];
}

export function parseBridgePackName(value: string | undefined): BridgePackName | null {
  if (!value) {
    return null;
  }

  return isBridgePackName(value) ? value : null;
}

export function getBridgePackCatalogEntry(name: BridgePackName): BridgePackCatalogEntry {
  return PACK_CATALOG[name];
}

export function getPackSkillName(name: BridgePackName): string {
  return getBridgePackCatalogEntry(name).skillName;
}

export function getDefaultBridgePackName(): BridgePackName {
  return DEFAULT_BRIDGE_PACK;
}
