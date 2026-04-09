import test from "node:test";
import assert from "node:assert/strict";

import { TELEGRAM_PACK } from "../packs/telegram/index.js";

test("telegram pack keeps the dynamic tool allowlist minimal", () => {
  assert.deepEqual(TELEGRAM_PACK.platformActions.getDynamicToolDeclarations(), [{
    name: "send_telegram_document",
    description: "Send a local server file to the active control surface as a document attachment.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        caption: { type: "string" },
        filename: { type: "string" }
      },
      required: ["path"]
    }
  }]);
});

test("telegram pack interpreter classifies allowlisted platform actions separately from unsupported dynamic tools", () => {
  assert.deepEqual(
    TELEGRAM_PACK.platformActions.interpretServerRequest({
      id: "server-1",
      method: "item/tool/call",
      params: {
        tool: "send_telegram_document",
        arguments: {
          path: "/tmp/file.txt",
          caption: "Result",
          filename: "file.txt"
        }
      }
    }),
    {
      kind: "platform_action",
      action: "send_control_surface_file",
      toolName: "send_telegram_document",
      path: "/tmp/file.txt",
      caption: "Result",
      fileName: "file.txt"
    }
  );

  assert.deepEqual(
    TELEGRAM_PACK.platformActions.interpretServerRequest({
      id: "server-2",
      method: "item/tool/call",
      params: {
        tool: "custom_platform_action"
      }
    }),
    {
      kind: "unsupported",
      errorCode: -32601,
      errorMessage: "Dynamic tool call is not supported by the active bridge pack: custom_platform_action",
      userMessage: "Codex 发起了动态工具调用（custom_platform_action），但当前 bridge pack 仅声明了这些 dynamic tools：send_telegram_document。",
      logDetail: "tool=custom_platform_action"
    }
  );
});
