export const SUPPORTED_BRIDGE_PACKS = ["telegram", "feishu"] as const;

export type BridgePackName = (typeof SUPPORTED_BRIDGE_PACKS)[number];

export const DEFAULT_BRIDGE_PACK: BridgePackName = "telegram";

export function isBridgePackName(value: string): value is BridgePackName {
  return (SUPPORTED_BRIDGE_PACKS as readonly string[]).includes(value);
}
