import test from "node:test";
import assert from "node:assert/strict";

import { routeBridgeCommand } from "./command-router.js";
import { buildHelpText, buildTelegramCommands, TELEGRAM_COMMANDS } from "../telegram/commands.js";

function createHandlers(calls: string[]) {
  return {
    sendHelp: async () => { calls.push("sendHelp"); },
    handleCommands: async () => { calls.push("handleCommands"); },
    sendStatus: async () => { calls.push("sendStatus"); },
    handleHub: async () => { calls.push("handleHub"); },
    handleNew: async () => { calls.push("handleNew"); },
    handleResume: async () => { calls.push("handleResume"); },
    handleBrowse: async () => { calls.push("handleBrowse"); },
    handleRetrieve: async () => { calls.push("handleRetrieve"); },
    handleSide: async () => { calls.push("handleSide"); },
    handleCancel: async () => { calls.push("handleCancel"); },
    handleSessions: async () => { calls.push("handleSessions"); },
    handleArchive: async () => { calls.push("handleArchive"); },
    sendWhere: async () => { calls.push("sendWhere"); },
    handleInterrupt: async () => { calls.push("handleInterrupt"); },
    handleInspect: async () => { calls.push("handleInspect"); },
    handleRuntime: async () => { calls.push("handleRuntime"); },
    handleLanguage: async () => { calls.push("handleLanguage"); },
    handleUse: async () => { calls.push("handleUse"); },
    handleUnarchive: async () => { calls.push("handleUnarchive"); },
    handleRename: async () => { calls.push("handleRename"); },
    handlePin: async () => { calls.push("handlePin"); },
    handlePlan: async () => { calls.push("handlePlan"); },
    handleModel: async () => { calls.push("handleModel"); },
    handleSkills: async () => { calls.push("handleSkills"); },
    handleSkill: async () => { calls.push("handleSkill"); },
    handlePlugins: async () => { calls.push("handlePlugins"); },
    handlePlugin: async () => { calls.push("handlePlugin"); },
    handleApps: async () => { calls.push("handleApps"); },
    handleMcp: async () => { calls.push("handleMcp"); },
    handleAccount: async () => { calls.push("handleAccount"); },
    handleReview: async () => { calls.push("handleReview"); },
    handleFork: async () => { calls.push("handleFork"); },
    handleRollback: async () => { calls.push("handleRollback"); },
    handleClear: async () => { calls.push("handleClear"); },
    handleCompact: async () => { calls.push("handleCompact"); },
    handleLocalImage: async () => { calls.push("handleLocalImage"); },
    handleMention: async () => { calls.push("handleMention"); },
    handleAttach: async () => { calls.push("handleAttach"); },
    handleThread: async () => { calls.push("handleThread"); },
    sendUnsupported: async () => { calls.push("sendUnsupported"); }
  };
}

test("routeBridgeCommand routes every synced command through the registry", async () => {
  for (const entry of TELEGRAM_COMMANDS) {
    const calls: string[] = [];
    await routeBridgeCommand(entry.command, createHandlers(calls));
    assert.equal(calls.length, 1);
    assert.notEqual(calls[0], "sendUnsupported");
  }
});

test("retrieve is registered with localized help and dispatches to its handler", async () => {
  const calls: string[] = [];
  await routeBridgeCommand("retrieve", createHandlers(calls));

  assert.deepEqual(calls, ["handleRetrieve"]);
  assert.deepEqual(
    TELEGRAM_COMMANDS.find((entry) => entry.command === "retrieve"),
    { command: "retrieve", description: "发送本地文件到聊天" }
  );
  assert.equal(
    buildTelegramCommands("en").find((entry) => entry.command === "retrieve")?.description,
    "Send a local file to this chat"
  );
  assert.match(buildHelpText("zh"), /\/retrieve <文件路径> 发送当前项目文件；项目外文件需要确认/u);
  assert.match(buildHelpText("en"), /\/retrieve <file path> Send a project file; external files require confirmation/u);
});

test("side is registered with localized help and dispatches to its handler", async () => {
  const calls: string[] = [];
  await routeBridgeCommand("side", createHandlers(calls));

  assert.deepEqual(calls, ["handleSide"]);
  assert.equal(buildTelegramCommands("en").find(({ command }) => command === "side")?.description, "Start a temporary side conversation");
  assert.match(buildHelpText("zh"), /\/side \[问题\] 开启临时 Side 对话；\/side back 返回主会话/u);
});

test("routeBridgeCommand keeps aliases and unsupported fallback aligned with the registry", async () => {
  const calls: string[] = [];
  const handlers = createHandlers(calls);

  await routeBridgeCommand("start", handlers);
  await routeBridgeCommand("commands", handlers);
  await routeBridgeCommand("clear", handlers);
  await routeBridgeCommand("does_not_exist", handlers);

  assert.deepEqual(calls, ["sendHelp", "handleCommands", "handleClear", "sendUnsupported"]);
});
