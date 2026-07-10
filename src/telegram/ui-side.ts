import type { TelegramInlineKeyboardMarkup } from "./api.js";
import type { SessionStatus, UiLanguage } from "../types.js";
import {
  encodeSideBackCallback,
  encodeSideInterruptCallback,
  encodeSideReturnCancelCallback,
  encodeSideReturnConfirmCallback,
  encodeSideStatusCallback
} from "./ui-callbacks.js";
import { escapeHtml } from "./ui-shared.js";

export type SideParentStatus = "idle" | "running" | "waiting_input" | "waiting_approval" | "completed" | "interrupted" | "failed" | "closed";

export interface SideCardViewModel {
  token: string;
  language: UiLanguage;
  projectName: string;
  parentSessionName: string;
  sideStatus: SessionStatus;
  parentStatus: SideParentStatus;
  parentNeedsAction: boolean;
  heldResultCount: number;
}

export function buildSideSessionCardMessage(view: SideCardViewModel): { text: string; replyMarkup: TelegramInlineKeyboardMarkup } {
  const en = view.language === "en";
  const backButton = (text: string) => ({ text, callback_data: encodeSideBackCallback(view.token) });
  const controls = view.parentNeedsAction
    ? [backButton(en ? "Return and handle approval" : "返回并处理审批")]
    : view.heldResultCount > 0
      ? [backButton(en ? "Return to view results" : "返回查看结果")]
      : view.sideStatus === "running"
        ? [
            { text: en ? "Interrupt Side" : "中断 Side", callback_data: encodeSideInterruptCallback(view.token) },
            backButton(en ? "Return to main" : "返回主会话")
          ]
        : [
            { text: en ? "Parent status" : "主任务状态", callback_data: encodeSideStatusCallback(view.token) },
            backButton(en ? "Return to main" : "返回主会话")
          ];
  const held = view.heldResultCount > 0 ? `\n${en ? "Held results" : "待查看结果"}: ${view.heldResultCount}` : "";

  return {
    text: `<b>↪ Side</b>\n${en ? "Project" : "项目"}: ${escapeHtml(view.projectName)}\n${en ? "Parent" : "主会话"}: ${escapeHtml(view.parentSessionName)}\n${en ? "Side state" : "Side 状态"}: ${sideStatusLabel(view.sideStatus, view.language)}\n${en ? "Parent state" : "主任务状态"}: ${parentStatusLabel(view.parentStatus, view.language)}${held}`,
    replyMarkup: { inline_keyboard: [controls] }
  };
}

export function buildSideParentStatusMessage(view: SideCardViewModel): string {
  const en = view.language === "en";
  return `<b>${en ? "Parent task status" : "主任务状态"}</b>\n${en ? "Session" : "会话"}: ${escapeHtml(view.parentSessionName)}\n${en ? "State" : "状态"}: ${parentStatusLabel(view.parentStatus, view.language)}`;
}

export function buildSideReturnConfirmationMessage(token: string, language: UiLanguage): { text: string; replyMarkup: TelegramInlineKeyboardMarkup } {
  const en = language === "en";
  return {
    text: en ? "Returning now will interrupt the running Side conversation." : "现在返回将中断正在运行的 Side 对话。",
    replyMarkup: { inline_keyboard: [[
      { text: en ? "Interrupt and return" : "中断并返回", callback_data: encodeSideReturnConfirmCallback(token) },
      { text: en ? "Continue Side" : "继续 Side", callback_data: encodeSideReturnCancelCallback(token) }
    ]] }
  };
}

function sideStatusLabel(status: SessionStatus, language: UiLanguage): string {
  const labels: Record<SessionStatus, Record<UiLanguage, string>> = {
    idle: { zh: "空闲", en: "idle" }, running: { zh: "运行中", en: "running" },
    interrupted: { zh: "已中断", en: "interrupted" }, failed: { zh: "失败", en: "failed" }
  };
  return labels[status][language];
}

function parentStatusLabel(status: SideParentStatus, language: UiLanguage): string {
  const labels: Record<SideParentStatus, Record<UiLanguage, string>> = {
    idle: { zh: "空闲", en: "idle" }, running: { zh: "运行中", en: "running" },
    waiting_input: { zh: "等待输入", en: "waiting for input" }, waiting_approval: { zh: "等待审批", en: "waiting for approval" },
    completed: { zh: "已完成（结果待查看）", en: "completed (result held)" }, interrupted: { zh: "已中断", en: "interrupted" },
    failed: { zh: "失败", en: "failed" }, closed: { zh: "已关闭", en: "closed" }
  };
  return labels[status][language];
}
