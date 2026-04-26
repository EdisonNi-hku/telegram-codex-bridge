import test from "node:test";
import assert from "node:assert/strict";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLogger } from "../logger.js";
import { getBridgePaths } from "../paths.js";
import { BridgeStateStore } from "../state/store.js";
import type { BridgePlatform } from "../core/domain/binding.js";
import type { ChatBindingRow } from "../types.js";
import {
  buildWebReadonlyLocalHarnessConfig,
  startWebReadonlyLocalHarness
} from "./readonly-cli.js";

const secretToken = "super-secret-local-token";

test("web readonly harness refuses to build without an explicit token", () => {
  assert.throws(
    () => buildWebReadonlyLocalHarnessConfig({ env: {} }),
    /CTB_WEB_READONLY_TOKEN|--token/u
  );
});

test("web readonly harness defaults to localhost and accepts env token", () => {
  const config = buildWebReadonlyLocalHarnessConfig({ env: { CTB_WEB_READONLY_TOKEN: secretToken } });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 0);
  assert.equal(config.access.enabled, true);
});

test("web readonly harness accepts env platform filters", () => {
  for (const platform of ["telegram", "feishu"] as const) {
    const config = buildWebReadonlyLocalHarnessConfig({
      env: {
        CTB_WEB_READONLY_TOKEN: secretToken,
        CTB_WEB_READONLY_PLATFORM: platform
      }
    });

    assert.equal(config.platform, platform);
  }
});

test("web readonly harness accepts platform options", () => {
  for (const platform of ["telegram", "feishu"] as const) {
    const config = buildWebReadonlyLocalHarnessConfig({ token: secretToken, platform });

    assert.equal(config.platform, platform);
  }
});

test("web readonly harness accepts platform argv flags", () => {
  for (const platform of ["telegram", "feishu"] as const) {
    const config = buildWebReadonlyLocalHarnessConfig({
      token: secretToken,
      argv: ["node", "ctb", "web", "readonly", "--platform", platform]
    });

    assert.equal(config.platform, platform);
  }
});

test("web readonly harness rejects invalid platform filters", () => {
  for (const platform of ["slack", "Telegram", "", true] as const) {
    assert.throws(
      () => buildWebReadonlyLocalHarnessConfig({ token: secretToken, platform }),
      /CTB_WEB_READONLY_PLATFORM|--platform/u
    );
  }
});

test("web readonly harness rejects non-local host override", () => {
  assert.throws(
    () => buildWebReadonlyLocalHarnessConfig({ token: secretToken, host: "0.0.0.0" }),
    /local-only/u
  );
});

test("web readonly harness start output never prints the token", async () => {
  const homeDir = await mkdtemp(join(tmpdir(), "ctb-web-readonly-home-"));
  const paths = getBridgePaths(import.meta.url, homeDir);
  const logger = createLogger("web-readonly-cli-test", paths.bootstrapLogPath);
  const lines: string[] = [];

  try {
    const harness = await startWebReadonlyLocalHarness({
      paths,
      logger,
      token: secretToken,
      port: 0,
      write: (line) => lines.push(line)
    });
    await harness.close();

    const output = lines.join("\n");
    assert.match(output, /http:\/\/127\.0\.0\.1:\d+\//u);
    assert.match(output, /read-only prototype/u);
    assert.match(output, /Bearer token required/u);
    assert.equal(output.includes(secretToken), false);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test("web readonly harness start filters operator bindings by configured platform without printing secrets", async () => {
  for (const platform of ["telegram", "feishu"] as const) {
    const homeDir = await mkdtemp(join(tmpdir(), `ctb-web-readonly-${platform}-home-`));
    const paths = getBridgePaths(import.meta.url, homeDir);
    const logger = createLogger("web-readonly-cli-test", paths.bootstrapLogPath);
    const lines: string[] = [];
    const calls: Array<{ argc: number; platform: BridgePlatform | undefined }> = [];
    const original = BridgeStateStore.prototype.listChatBindings;
    BridgeStateStore.prototype.listChatBindings = function patchedListChatBindings(
      this: BridgeStateStore,
      platformArg?: BridgePlatform
    ): ChatBindingRow[] {
      calls.push({ argc: arguments.length, platform: platformArg });
      return [bindingRow("chat-secret", platformArg ?? platform)];
    };

    try {
      const harness = await startWebReadonlyLocalHarness({
        paths,
        logger,
        token: secretToken,
        port: 0,
        ...(platform === "telegram" ? { platform } : { argv: ["node", "ctb", "web", "readonly", "--platform", platform] }),
        write: (line) => lines.push(line)
      });
      await harness.close();

      assert.deepEqual(calls, [{ argc: 1, platform }]);
      const output = lines.join("\n");
      assert.match(output, /http:\/\/127\.0\.0\.1:\d+\//u);
      assert.equal(output.includes(secretToken), false);
      assert.equal(output.includes("chat-secret"), false);
    } finally {
      BridgeStateStore.prototype.listChatBindings = original;
      await rm(homeDir, { recursive: true, force: true });
    }
  }
});

test("web readonly harness start uses unfiltered binding resolution by default", async () => {
  const homeDir = await mkdtemp(join(tmpdir(), "ctb-web-readonly-unfiltered-home-"));
  const paths = getBridgePaths(import.meta.url, homeDir);
  const logger = createLogger("web-readonly-cli-test", paths.bootstrapLogPath);
  const calls: Array<{ argc: number; platform: BridgePlatform | undefined }> = [];
  const original = BridgeStateStore.prototype.listChatBindings;
  BridgeStateStore.prototype.listChatBindings = function patchedListChatBindings(
    this: BridgeStateStore,
    platformArg?: BridgePlatform
  ): ChatBindingRow[] {
    calls.push({ argc: arguments.length, platform: platformArg });
    return [];
  };

  try {
    const harness = await startWebReadonlyLocalHarness({
      paths,
      logger,
      token: secretToken,
      port: 0,
      write: () => undefined
    });
    await harness.close();

    assert.deepEqual(calls, [{ argc: 0, platform: undefined }]);
  } finally {
    BridgeStateStore.prototype.listChatBindings = original;
    await rm(homeDir, { recursive: true, force: true });
  }
});

function bindingRow(chatId: string, platform: BridgePlatform): ChatBindingRow {
  return {
    platform,
    chatId,
    userId: `${platform}-user-secret`,
    telegramChatId: chatId,
    telegramUserId: `${platform}-user-secret`,
    activeSessionId: null,
    createdAt: "2026-04-26T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z"
  };
}
