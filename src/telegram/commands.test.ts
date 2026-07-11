import test from "node:test";
import assert from "node:assert/strict";

import {
  TELEGRAM_COMMANDS,
  buildTelegramCommands,
  buildHelpText,
  getDefaultCommandPanelCommands,
  normalizeCommandPanelCommands,
  resolveTelegramCommandHandler,
  syncTelegramCommands
} from "./commands.js";
import type { TelegramBotCommand, TelegramBotCommandScope } from "./api.js";

test("syncTelegramCommands syncs default and language-specific command scopes", async () => {
  const calls: CommandSyncCall[] = [];

  await syncTelegramCommands({
    setMyCommands: async (
      _commands: TelegramBotCommand[],
      scope?: TelegramBotCommandScope,
      languageCode?: string
    ) => {
      calls.push({ scope, languageCode });
      assert.equal(_commands.some((entry) => entry.command === "language"), true);
      assert.equal(_commands.find((entry) => entry.command === "help")?.description, "Show full help");
    }
  } as any, "en");

  const expected: CommandSyncCall[] = [
    { scope: { type: "default" }, languageCode: undefined },
    { scope: { type: "default" }, languageCode: "zh" },
    { scope: { type: "default" }, languageCode: "en" },
    { scope: { type: "all_private_chats" }, languageCode: undefined },
    { scope: { type: "all_private_chats" }, languageCode: "zh" },
    { scope: { type: "all_private_chats" }, languageCode: "en" }
  ];

  assert.deepEqual(calls.sort(compareCalls), expected.sort(compareCalls));
});

test("telegram-only commands are omitted outside the Telegram pack", async () => {
  assert.equal(buildTelegramCommands("zh", "telegram").some(({ command }) => command === "side"), true);
  assert.equal(buildTelegramCommands("zh", "telegram").some(({ command }) => command === "retrieve"), true);
  assert.equal(buildTelegramCommands("zh", "telegram").some(({ command }) => command === "upload"), true);
  assert.equal(buildTelegramCommands("zh", "feishu").some(({ command }) => command === "side"), false);
  assert.equal(buildTelegramCommands("zh", "feishu").some(({ command }) => command === "retrieve"), false);
  assert.equal(buildTelegramCommands("zh", "feishu").some(({ command }) => command === "upload"), false);

  const synced: string[][] = [];
  await syncTelegramCommands({
    setMyCommands: async (commands: TelegramBotCommand[]) => { synced.push(commands.map(({ command }) => command)); }
  } as any, "zh", "feishu");
  assert.equal(synced.every((commands) => !commands.includes("side") && !commands.includes("retrieve") && !commands.includes("upload")), true);
});

test("upload is localized across Telegram command, help, and sync surfaces", async () => {
  assert.deepEqual(buildTelegramCommands("zh", "telegram").find(({ command }) => command === "upload"), {
    command: "upload", description: "上传文件到项目根目录"
  });
  assert.deepEqual(buildTelegramCommands("en", "telegram").find(({ command }) => command === "upload"), {
    command: "upload", description: "Upload a file to the project root"
  });
  assert.match(buildHelpText("zh", "telegram"), /\/upload 保存下一份文件到项目根目录，不发送给 Codex/u);
  assert.match(buildHelpText("en", "telegram"), /\/upload Save the next file to the project root without sending it to Codex/u);
  assert.doesNotMatch(buildHelpText("zh", "feishu"), /\/upload/u);
  assert.doesNotMatch(buildHelpText("en", "feishu"), /\/upload/u);

  const synced: TelegramBotCommand[][] = [];
  await syncTelegramCommands({
    setMyCommands: async (commands: TelegramBotCommand[]) => { synced.push(commands); }
  } as any, "en", "telegram");
  assert.equal(synced.length, 6);
  assert.equal(synced.every((commands) => commands.some(({ command }) => command === "upload")), true);
});

test("buildHelpText stays aligned with the command registry", () => {
  const helpText = buildHelpText("zh");

  assert.ok(helpText.startsWith("可用指令\n/help 查看完整帮助"));
  assert.ok(helpText.includes("/commands 打开快捷指令卡；/commands edit 编辑快捷指令"));
  assert.ok(helpText.includes("/sessions 查看最近会话\n/sessions archived 查看已归档会话"));
  assert.ok(helpText.includes("/archive 归档当前会话\n/archive all 归档所有非运行中会话"));
  assert.ok(helpText.includes("/hub 重新查看运行卡片"));
  assert.ok(helpText.includes("/runtime 配置运行状态卡片顶部摘要行"));
  assert.ok(helpText.includes("/language 切换桥接界面语言"));
  assert.ok(helpText.endsWith("/cancel 取消当前输入并返回"));
});

test("buildHelpText renders the English command surface when requested", () => {
  const helpText = buildHelpText("en");

  assert.ok(helpText.startsWith("Available commands\n/help Show full help"));
  assert.ok(helpText.includes("/commands Open the command panel; /commands edit edits quick commands"));
  assert.ok(helpText.includes("/sessions Show recent sessions\n/sessions archived Show archived sessions"));
  assert.ok(helpText.includes("/archive Archive the current session\n/archive all Archive every non-running session"));
  assert.ok(helpText.includes("/hub Bring back the runtime hub"));
  assert.ok(helpText.includes("/language Change bridge UI language"));
  assert.ok(helpText.endsWith("/cancel Cancel the current input and return"));
});

test("resolveTelegramCommandHandler keeps aliases and synced commands aligned", () => {
  assert.equal(resolveTelegramCommandHandler("start"), "sendHelp");
  assert.equal(resolveTelegramCommandHandler("commands"), "handleCommands");
  assert.equal(resolveTelegramCommandHandler("clear"), "handleClear");
  assert.equal(resolveTelegramCommandHandler("upload"), "handleUpload");

  for (const entry of TELEGRAM_COMMANDS) {
    assert.notEqual(resolveTelegramCommandHandler(entry.command), null);
  }

  assert.equal(resolveTelegramCommandHandler("does_not_exist"), null);
});

test("normalizeCommandPanelCommands keeps only selectable commands and falls back to defaults", () => {
  assert.deepEqual(
    normalizeCommandPanelCommands(["status", "thread", "skills", "status"]),
    ["status", "skills"]
  );
  assert.deepEqual(normalizeCommandPanelCommands(["thread", "plugin"]), getDefaultCommandPanelCommands());
});

interface CommandSyncCall {
  scope: TelegramBotCommandScope | undefined;
  languageCode: string | undefined;
}

function compareCalls(left: CommandSyncCall, right: CommandSyncCall): number {
  return `${left.scope?.type ?? ""}:${left.languageCode ?? ""}`
    .localeCompare(`${right.scope?.type ?? ""}:${right.languageCode ?? ""}`);
}
