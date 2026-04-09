import type { BridgeConfig } from "../config.js";
import { DEFAULT_BRIDGE_PACK, type BridgePackName } from "./names.js";
import type { BridgePackDefinition } from "./contract.js";
import { FEISHU_PACK } from "./feishu/index.js";
import { TELEGRAM_PACK } from "./telegram/index.js";

function getPackRegistry(): Record<BridgePackName, BridgePackDefinition> {
  return {
    feishu: FEISHU_PACK,
    telegram: TELEGRAM_PACK
  };
}

export function getBridgePack(name: BridgePackName): BridgePackDefinition {
  return getPackRegistry()[name];
}

export function getActiveBridgePack(config: BridgeConfig): BridgePackDefinition {
  return getBridgePack(config.activePack ?? DEFAULT_BRIDGE_PACK);
}

export function listBridgePacks(): BridgePackDefinition[] {
  return Object.values(getPackRegistry());
}
