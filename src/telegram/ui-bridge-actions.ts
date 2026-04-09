import type { BridgeCommandActionView } from "../core/interaction-model/bridge-actions.js";
import type { UiLanguage } from "../types.js";
import type { TelegramInlineKeyboardMarkup } from "./api.js";
import { encodeCommandPanelOpenCallback, encodeCommandPanelRunCallback } from "./ui-callbacks.js";

const BRIDGE_COMMAND_ACTION_LABELS: Record<
  BridgeCommandActionView["command"],
  Record<UiLanguage, string>
> = {
  cancel: {
    zh: "取消",
    en: "Cancel"
  },
  hub: {
    zh: "运行卡",
    en: "Hub"
  },
  status: {
    zh: "状态",
    en: "Status"
  },
  inspect: {
    zh: "详情",
    en: "Inspect"
  },
  interrupt: {
    zh: "中断操作",
    en: "Interrupt"
  },
  commands: {
    zh: "命令",
    en: "Commands"
  }
};

export function buildBridgeCommandActionRows(
  actions: readonly BridgeCommandActionView[],
  language: UiLanguage,
  options?: {
    chunkSize?: number;
  }
): TelegramInlineKeyboardMarkup["inline_keyboard"] {
  const chunkSize = Math.max(1, options?.chunkSize ?? 3);
  const rows: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  let currentRow: TelegramInlineKeyboardMarkup["inline_keyboard"][number] = [];

  for (const action of actions) {
    currentRow.push({
      text: BRIDGE_COMMAND_ACTION_LABELS[action.command][language],
      callback_data: action.command === "commands"
        ? encodeCommandPanelOpenCallback()
        : encodeCommandPanelRunCallback(action.command),
      ...(action.style ? { style: action.style } : {})
    });
    if (currentRow.length >= chunkSize) {
      rows.push(currentRow);
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

export function buildBridgeCommandReplyMarkup(
  actions: readonly BridgeCommandActionView[],
  language: UiLanguage,
  options?: {
    chunkSize?: number;
  }
): TelegramInlineKeyboardMarkup | undefined {
  const rows = buildBridgeCommandActionRows(actions, language, options);
  if (rows.length === 0) {
    return undefined;
  }

  return {
    inline_keyboard: rows
  };
}
