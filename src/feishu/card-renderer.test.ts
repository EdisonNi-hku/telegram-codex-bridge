import test from "node:test";
import assert from "node:assert/strict";

import { buildFeishuInteractiveCard } from "./card-renderer.js";
import {
  encodeBrowseCloseCallback,
  encodeNewBrowseOpenCallback,
  encodePathBackCallback,
  encodePathManualCallback,
  encodePickCallback,
  encodeStatusInterruptCallback
} from "../telegram/ui-callbacks.js";

function parseCard(payload: string): Record<string, any> {
  return JSON.parse(payload) as Record<string, any>;
}

function collectByTag(node: unknown, tag: string, results: Record<string, any>[] = []): Record<string, any>[] {
  if (Array.isArray(node)) {
    for (const entry of node) {
      collectByTag(entry, tag, results);
    }
    return results;
  }

  if (!node || typeof node !== "object") {
    return results;
  }

  const record = node as Record<string, any>;
  if (record.tag === tag) {
    results.push(record);
  }

  for (const value of Object.values(record)) {
    collectByTag(value, tag, results);
  }

  return results;
}

test("buildFeishuInteractiveCard emits JSON 2.0 cards with summary and overflow actions", () => {
  const payload = buildFeishuInteractiveCard(
    [
      "<b>欢迎使用 Codex Bridge</b>",
      "",
      "1. Project One",
      "2. Project Two",
      "",
      "从飞书里直接继续你的最近工作。"
    ].join("\n"),
    {
      inline_keyboard: [[
        { text: "1", callback_data: encodePickCallback("project-1") },
        { text: "2", callback_data: encodePickCallback("project-2") },
        { text: "浏览目录", callback_data: encodeNewBrowseOpenCallback() },
        { text: "手动输入", callback_data: encodePathManualCallback() },
        { text: "返回", callback_data: encodePathBackCallback() },
        { text: "关闭", callback_data: encodeBrowseCloseCallback("browse-token") }
      ]]
    }
  );
  const card = parseCard(payload);
  const buttons = collectByTag(card.body, "button");
  const overflow = collectByTag(card.body, "overflow");

  assert.equal(card.schema, "2.0");
  assert.equal(card.header?.title?.content, "欢迎使用 Codex Bridge");
  assert.match(card.config?.summary?.content ?? "", /Project One/u);
  assert.equal(buttons[0]?.text?.content, "Project One");
  assert.equal(buttons[1]?.text?.content, "Project Two");
  assert.equal(overflow.length, 1);
  assert.deepEqual(overflow[0]?.options?.map((option: any) => option.text?.content), ["返回", "关闭"]);
});

test("buildFeishuInteractiveCard maps interrupt actions to danger buttons with confirmation", () => {
  const payload = buildFeishuInteractiveCard(
    "<b>运行中</b>\n\n你可以检查状态或停止当前操作。",
    {
      inline_keyboard: [[
        {
          text: "中断",
          callback_data: encodeStatusInterruptCallback("session-1")
        }
      ]]
    }
  );
  const card = parseCard(payload);
  const buttons = collectByTag(card.body, "button");

  assert.equal(buttons.length, 1);
  assert.equal(buttons[0]?.type, "danger");
  assert.equal(buttons[0]?.confirm?.title?.content, "确认中断");
  assert.equal(buttons[0]?.confirm?.text?.content, "要停止当前正在运行的操作吗？");
  assert.equal(buttons[0]?.behaviors?.[0]?.value?.callback_data, encodeStatusInterruptCallback("session-1"));
});
