import test from "node:test";
import assert from "node:assert/strict";

import { dispatchHtmlSurface } from "./surface-dispatcher.js";

const FULL_CAPABILITIES = {
  supportsCallbacks: true,
  supportsEdits: true,
  supportsRichTextPreview: true,
  supportsLongFormPagination: true,
  supportsUploads: true,
  canSendImage: true,
  canSendFile: true,
  canReceiveImage: true,
  canReceiveFile: true,
  canReceiveVoice: true,
  canUseRemoteImageUrl: false
} as const;

test("dispatchHtmlSurface returns edited for runtime surfaces when edit succeeds", async () => {
  const result = await dispatchHtmlSurface({
    intent: "runtime_status",
    chatId: "chat-1",
    html: "<b>Runtime</b>",
    existingMessageId: 42,
    preferEdit: true,
    capabilities: FULL_CAPABILITIES,
    sendHtmlMessage: async () => {
      throw new Error("send should not be called");
    },
    editHtmlMessage: async () => ({ outcome: "edited" })
  });

  assert.deepEqual(result, {
    intent: "runtime_status",
    outcome: "edited",
    deliveryRef: { messageId: 42 }
  });
});

test("dispatchHtmlSurface returns sent for interaction surfaces when direct send succeeds", async () => {
  const result = await dispatchHtmlSurface({
    intent: "pending_interaction",
    chatId: "chat-1",
    html: "<b>Interaction</b>",
    capabilities: FULL_CAPABILITIES,
    requirements: {
      requiresCallbacks: true,
      requiresRichTextPreview: true
    },
    sendHtmlMessage: async () => ({ message_id: 99 })
  });

  assert.deepEqual(result, {
    intent: "pending_interaction",
    outcome: "sent",
    deliveryRef: { messageId: 99 }
  });
});

test("dispatchHtmlSurface defers terminal delivery when callbacks are unavailable", async () => {
  const result = await dispatchHtmlSurface({
    intent: "terminal_result",
    deferredIntent: "terminal_result_deferred_notice",
    chatId: "chat-1",
    html: "<b>Terminal</b>",
    capabilities: {
      ...FULL_CAPABILITIES,
      supportsCallbacks: false
    },
    requirements: {
      requiresCallbacks: true,
      requiresLongFormPagination: true
    },
    sendHtmlMessage: async () => {
      throw new Error("send should not be called");
    }
  });

  assert.deepEqual(result, {
    intent: "terminal_result",
    outcome: "deferred",
    deferredIntent: "terminal_result_deferred_notice",
    deliveryRef: { messageId: null }
  });
});

test("dispatchHtmlSurface surfaces rate-limited runtime edits as failed with retry metadata", async () => {
  const result = await dispatchHtmlSurface({
    intent: "runtime_hub",
    chatId: "chat-1",
    html: "<b>Hub</b>",
    existingMessageId: 55,
    preferEdit: true,
    capabilities: FULL_CAPABILITIES,
    sendHtmlMessage: async () => {
      throw new Error("send should not be called after rate limit");
    },
    editHtmlMessage: async () => ({ outcome: "rate_limited", retryAfterMs: 1200 })
  });

  assert.deepEqual(result, {
    intent: "runtime_hub",
    outcome: "failed",
    reason: "rate_limited",
    deliveryRef: { messageId: 55 },
    retryAfterMs: 1200
  });
});

test("dispatchHtmlSurface returns failed for interaction surfaces when send cannot commit", async () => {
  const result = await dispatchHtmlSurface({
    intent: "pending_interaction",
    chatId: "chat-1",
    html: "<b>Interaction</b>",
    capabilities: FULL_CAPABILITIES,
    requirements: {
      requiresCallbacks: true
    },
    sendHtmlMessage: async () => null
  });

  assert.deepEqual(result, {
    intent: "pending_interaction",
    outcome: "failed",
    reason: "send_failed",
    deliveryRef: { messageId: null }
  });
});

test("dispatchHtmlSurface blocks callback-only interaction delivery when the platform lacks callbacks", async () => {
  const result = await dispatchHtmlSurface({
    intent: "pending_interaction",
    chatId: "chat-1",
    html: "<b>Interaction</b>",
    capabilities: {
      ...FULL_CAPABILITIES,
      supportsCallbacks: false
    },
    requirements: {
      requiresCallbacks: true
    },
    sendHtmlMessage: async () => {
      throw new Error("send should not be called for a capability-blocked interaction");
    }
  });

  assert.deepEqual(result, {
    intent: "pending_interaction",
    outcome: "failed",
    reason: "capability_blocked",
    deliveryRef: { messageId: null }
  });
});
