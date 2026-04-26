import test from "node:test";
import assert from "node:assert/strict";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLogger } from "../logger.js";
import { getBridgePaths } from "../paths.js";
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
