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

test("validateFeishuUploadScopes validates image upload separately", async () => {
  const result = await validateFeishuUploadScopes({
    appId: "cli_test",
    appSecret: "secret",
    apiBaseUrl: "https://open.feishu.cn"
  }, {
    target: "image",
    probeUpload: async () => {
      throw {
        response: {
          data: {
            code: 99991672,
            msg: "Image access denied",
            error: {
              permission_violations: [
                { subject: "im:image:upload" }
              ]
            }
          }
        }
      };
    }
  });

  assert.deepEqual(result, {
    ok: false,
    summary: "feishu image upload is blocked; missing app scopes im:image:upload",
    errorCode: "99991672",
    errorMessage: "Image access denied",
    missingScopes: ["im:image:upload"]
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
