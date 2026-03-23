import test from "node:test";
import assert from "node:assert/strict";

import type { FinalAnswerViewRow } from "../../types.js";
import {
  createDeferredTerminalNoticeView,
  createTerminalResultDeliveryView
} from "./terminal-workflow.js";

function createFinalAnswerViewRow(
  overrides: Partial<FinalAnswerViewRow> = {}
): FinalAnswerViewRow {
  return {
    answerId: overrides.answerId ?? "answer-1",
    telegramChatId: overrides.telegramChatId ?? "chat-1",
    telegramMessageId: "telegramMessageId" in overrides ? overrides.telegramMessageId ?? null : null,
    sessionId: overrides.sessionId ?? "session-1",
    threadId: overrides.threadId ?? "thread-1",
    turnId: overrides.turnId ?? "turn-1",
    kind: overrides.kind ?? "final_answer",
    deliveryState: overrides.deliveryState ?? "pending",
    previewHtml: overrides.previewHtml ?? "<b>Preview</b>",
    pages: overrides.pages ?? ["<b>Full answer</b>"],
    primaryActionConsumed: overrides.primaryActionConsumed ?? false,
    createdAt: overrides.createdAt ?? "2026-03-23T00:00:00.000Z"
  };
}

test("createTerminalResultDeliveryView creates a semantic direct-delivery view", () => {
  const view = createTerminalResultDeliveryView(
    createFinalAnswerViewRow({
      kind: "plan_result",
      previewHtml: "<b>Plan preview</b>",
      pages: ["<b>Plan page 1</b>", "<b>Plan page 2</b>"]
    }),
    true
  );

  assert.deepEqual(view, {
    kind: "plan_result",
    html: "<b>Plan preview</b>",
    controls: {
      answerId: "answer-1",
      totalPages: 2,
      collapsible: true,
      expanded: false,
      primaryActionConsumed: false
    }
  });
});

test("createDeferredTerminalNoticeView creates semantic notice copy without Telegram state decisions", () => {
  const finalAnswerNotice = createDeferredTerminalNoticeView(
    createFinalAnswerViewRow({
      kind: "final_answer",
      pages: ["<b>Page 1</b>", "<b>Page 2</b>"]
    })
  );
  const planNotice = createDeferredTerminalNoticeView(
    createFinalAnswerViewRow({
      kind: "plan_result",
      pages: ["<b>Plan 1</b>"]
    })
  );

  assert.deepEqual(finalAnswerNotice, {
    kind: "final_answer",
    html: "<i>最终答复暂未送达。点击“展开全文”重新渲染。</i>",
    controls: {
      answerId: "answer-1",
      totalPages: 2,
      collapsible: true,
      expanded: false,
      primaryActionConsumed: false
    }
  });
  assert.deepEqual(planNotice, {
    kind: "plan_result",
    html: "<i>方案结果暂未送达。点击“展开方案”重新渲染。</i>",
    controls: {
      answerId: "answer-1",
      totalPages: 1,
      collapsible: true,
      expanded: false,
      primaryActionConsumed: false
    }
  });
});
