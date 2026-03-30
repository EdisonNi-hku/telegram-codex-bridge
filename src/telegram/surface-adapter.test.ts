import test from "node:test";
import assert from "node:assert/strict";

import {
  createDeferredSurfaceOperationResult,
  isVisibleSurfaceOperationResult
} from "../core/interaction-model/surface.js";
import { executeTelegramHtmlSurfaceOperation } from "./surface-adapter.js";

test("executeTelegramHtmlSurfaceOperation edits in place when edit succeeds", async () => {
  const result = await executeTelegramHtmlSurfaceOperation({
    intent: "pending_interaction",
    chatId: "chat-1",
    html: "<b>Hello</b>",
    existingMessageId: 42,
    preferEdit: true,
    sendHtmlMessage: async () => {
      throw new Error("send should not be called");
    },
    editHtmlMessage: async () => ({ outcome: "edited" })
  });

  assert.deepEqual(result, {
    intent: "pending_interaction",
    outcome: "edited",
    deliveryRef: { messageId: 42 }
  });
});

test("executeTelegramHtmlSurfaceOperation falls back to send when edit does not commit", async () => {
  const result = await executeTelegramHtmlSurfaceOperation({
    intent: "pending_interaction",
    chatId: "chat-1",
    html: "<b>Hello</b>",
    existingMessageId: 42,
    preferEdit: true,
    sendHtmlMessage: async () => ({
      message_id: 99,
      chat: { id: 1, type: "private" },
      date: 0
    }),
    editHtmlMessage: async () => ({ outcome: "failed" })
  });

  assert.deepEqual(result, {
    intent: "pending_interaction",
    outcome: "sent",
    deliveryRef: { messageId: 99 }
  });
});

test("isVisibleSurfaceOperationResult treats deferred fallback as visible", () => {
  assert.equal(
    isVisibleSurfaceOperationResult(
      createDeferredSurfaceOperationResult(
        "terminal_result",
        "terminal_result_deferred_notice",
        88
      )
    ),
    true
  );
});
