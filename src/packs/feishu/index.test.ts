import test from "node:test";
import assert from "node:assert/strict";

import { validateFeishuUploadScopes } from "./index.js";

test("validateFeishuUploadScopes reports missing upload scopes clearly", async () => {
  const result = await validateFeishuUploadScopes({
    appId: "cli_test",
    appSecret: "secret",
    apiBaseUrl: "https://open.feishu.cn"
  }, {
    probeUpload: async () => {
      throw {
        response: {
          data: {
            code: 99991672,
            msg: "Access denied",
            error: {
              permission_violations: [
                { subject: "im:resource:upload" },
                { subject: "im:resource" }
              ]
            }
          }
        }
      };
    }
  });

  assert.deepEqual(result, {
    ok: false,
    summary: "feishu file upload is blocked; missing app scopes im:resource:upload, im:resource",
    errorCode: "99991672",
    errorMessage: "Access denied",
    missingScopes: ["im:resource:upload", "im:resource"]
  });
});

test("validateFeishuUploadScopes returns ok when upload probing succeeds", async () => {
  const result = await validateFeishuUploadScopes({
    appId: "cli_test",
    appSecret: "secret",
    apiBaseUrl: "https://open.feishu.cn"
  }, {
    probeUpload: async () => {}
  });

  assert.deepEqual(result, {
    ok: true,
    summary: "feishu file upload scopes validated",
    errorCode: null,
    errorMessage: null,
    missingScopes: []
  });
});
