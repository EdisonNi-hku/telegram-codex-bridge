import test from "node:test";
import assert from "node:assert/strict";

import { dispatchControlSurfaceFileAction } from "./platform-actions.js";

const FULL_CAPABILITIES = {
  supportsCallbacks: true,
  supportsEdits: true,
  supportsRichTextPreview: true,
  supportsLongFormPagination: true,
  supportsUploads: true
} as const;

test("dispatchControlSurfaceFileAction sends files when uploads are supported", async () => {
  const result = await dispatchControlSurfaceFileAction({
    capabilities: FULL_CAPABILITIES,
    request: {
      chatId: "chat-1",
      filePath: "/tmp/result.zip",
      caption: "artifact"
    },
    sendFile: async () => ({ messageId: 42 })
  });

  assert.deepEqual(result, {
    action: "send_control_surface_file",
    outcome: "sent",
    deliveryRef: { messageId: 42 }
  });
});

test("dispatchControlSurfaceFileAction blocks file delivery when uploads are unavailable", async () => {
  const result = await dispatchControlSurfaceFileAction({
    capabilities: {
      ...FULL_CAPABILITIES,
      supportsUploads: false
    },
    request: {
      chatId: "chat-1",
      filePath: "/tmp/result.zip"
    },
    sendFile: async () => {
      throw new Error("sendFile should not be called without upload capability");
    }
  });

  assert.deepEqual(result, {
    action: "send_control_surface_file",
    outcome: "failed",
    reason: "capability_blocked",
    deliveryRef: { messageId: null }
  });
});
