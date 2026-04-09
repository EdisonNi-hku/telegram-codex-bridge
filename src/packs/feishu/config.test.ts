import test from "node:test";
import assert from "node:assert/strict";

import { FEISHU_PACK_CONFIG_CODEC, getFeishuPackConfig } from "./config.js";

test("feishu config codec reads env and applies install options", () => {
  const envConfig = FEISHU_PACK_CONFIG_CODEC.readFromEnv({
    FEISHU_APP_ID: "cli_test",
    FEISHU_APP_SECRET: "secret",
    FEISHU_API_BASE_URL: "https://proxy.example.test"
  } as NodeJS.ProcessEnv, "/tmp");

  assert.deepEqual(envConfig, {
    appId: "cli_test",
    appSecret: "secret",
    apiBaseUrl: "https://proxy.example.test"
  });

  const overridden = FEISHU_PACK_CONFIG_CODEC.applyInstallOptions(envConfig, {
    "app-id": "cli_next",
    "app-secret": "secret-next",
    "api-base-url": "https://open.larksuite.com"
  });

  assert.deepEqual(overridden, {
    appId: "cli_next",
    appSecret: "secret-next",
    apiBaseUrl: "https://open.larksuite.com"
  });
});

test("getFeishuPackConfig falls back to defaults when pack config is absent", () => {
  const config = getFeishuPackConfig({
    packs: {}
  });

  assert.equal(config.appId, "");
  assert.equal(config.appSecret, "");
  assert.equal(config.apiBaseUrl, "https://open.feishu.cn");
});
