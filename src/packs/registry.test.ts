import test from "node:test";
import assert from "node:assert/strict";

import { getActiveBridgePack, getBridgePack } from "./registry.js";

test("telegram pack exposes the phase 3 pack contract surface", () => {
  const pack = getBridgePack("telegram");

  assert.equal(pack.name, "telegram");
  assert.equal(pack.ingress.ownsCallbacks, true);
  assert.equal(pack.ingress.ownsRichInput, true);
  assert.equal(pack.ingress.ownsMediaIngress, true);
  assert.equal(pack.egress.kind, "bot_api");
  assert.equal(pack.capabilities.supportsUploads, true);
  assert.equal(pack.capabilities.canReceiveFile, true);
  assert.deepEqual(
    pack.platformActions.getDynamicToolDeclarations().map((tool) => tool.name),
    ["send_telegram_document", "send_telegram_image"]
  );
});

test("active pack selection defaults to telegram when no explicit pack is provided", () => {
  const pack = getActiveBridgePack({
    activePack: "telegram",
    shared: {
      activePack: "telegram",
      codexBin: "codex",
      projectScanRoots: [],
      voiceInputEnabled: false,
      voiceOpenaiApiKey: "",
      voiceOpenaiTranscribeModel: "gpt-4o-mini-transcribe",
      voiceFfmpegBin: "ffmpeg",
      perfMonitorEnabled: false,
      perfMonitorSampleIntervalMs: 15_000,
      perfMonitorRetentionDays: 7
    },
    packs: {
      telegram: {
        botToken: "token",
        apiBaseUrl: "https://api.telegram.org",
        pollTimeoutSeconds: 20,
        pollIntervalMs: 1500
      }
    },
    codexBin: "codex",
    projectScanRoots: [],
    voiceInputEnabled: false,
    voiceOpenaiApiKey: "",
    voiceOpenaiTranscribeModel: "gpt-4o-mini-transcribe",
    voiceFfmpegBin: "ffmpeg",
    perfMonitorEnabled: false,
    perfMonitorSampleIntervalMs: 15_000,
    perfMonitorRetentionDays: 7
  });

  assert.equal(pack.name, "telegram");
});

test("feishu pack exposes the phase 4 pack contract surface", () => {
  const pack = getBridgePack("feishu");

  assert.equal(pack.name, "feishu");
  assert.equal(pack.ingress.ownsCallbacks, true);
  assert.equal(pack.ingress.ownsRichInput, false);
  assert.equal(pack.ingress.ownsMediaIngress, false);
  assert.equal(pack.egress.kind, "bot_api");
  assert.equal(pack.capabilities.supportsUploads, true);
  assert.equal(pack.capabilities.canReceiveImage, true);
  assert.deepEqual(
    pack.platformActions.getDynamicToolDeclarations().map((tool) => tool.name),
    ["send_feishu_file", "send_feishu_image"]
  );
});

test("feishu pack authorization binding is scoped to the feishu platform", () => {
  const pack = getBridgePack("feishu");
  const store = {
    getAuthorizedUser: (platform?: "telegram" | "feishu") => {
      assert.equal(platform, "feishu");
      return {
        platform: "feishu" as const,
        userId: "7500000000000001",
        username: null,
        telegramUserId: "7500000000000001",
        telegramUsername: null,
        displayName: null,
        firstSeenAt: "2026-04-08T00:00:00.000Z",
        updatedAt: "2026-04-08T00:00:00.000Z"
      };
    }
  };

  assert.equal(pack.authBinding.isBound(store as never), true);
});
