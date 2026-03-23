import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TelegramApi } from "./api.js";

function withEnvironment<T>(overrides: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
  const originalValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    originalValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return run().finally(() => {
    for (const [key, value] of originalValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function writeCurlStub(binDir: string): Promise<void> {
  const filePath = join(binDir, process.platform === "win32" ? "curl.cmd" : "curl");
  const content = process.platform === "win32"
    ? "@echo off\r\necho curl transport failed 1>&2\r\nexit /b 7\r\n"
    : "#!/usr/bin/env bash\necho 'curl transport failed' >&2\nexit 7\n";
  await writeFile(filePath, content, "utf8");
  if (process.platform !== "win32") {
    await chmod(filePath, 0o755);
  }
}

test("TelegramApi surfaces curl transport failures before JSON parsing", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-test-"));
  const binDir = join(root, "bin");

  try {
    await mkdir(binDir, { recursive: true });
    await writeCurlStub(binDir);

    const pathValue = process.platform === "win32"
      ? `${binDir};${process.env.PATH ?? ""}`
      : `${binDir}:${process.env.PATH ?? ""}`;

    await withEnvironment(
      {
        PATH: pathValue,
        HTTPS_PROXY: "http://proxy.internal:8080"
      },
      async () => {
        const api = new TelegramApi("test-token", "https://api.telegram.org");

        await assert.rejects(api.getMe(), (error: unknown) => {
          const message = String(error);
          assert.match(message, /curl transport failed/u);
          assert.doesNotMatch(message, /Unexpected end of JSON input/u);
          return true;
        });
      }
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("TelegramApi sends pin and unpin requests with the expected payload", async () => {
  const requests: Array<{ method: string; body: Record<string, unknown> }> = [];
  const server = createServer(async (req, res) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const bodyText = Buffer.concat(chunks).toString("utf8");
    requests.push({
      method: req.url?.split("/").pop() ?? "",
      body: JSON.parse(bodyText)
    });

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, result: true }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    const api = new TelegramApi("test-token", `http://127.0.0.1:${address.port}`);

    await api.pinChatMessage("chat-1", 123, { disableNotification: true });
    await api.unpinChatMessage("chat-1", 123);

    assert.deepEqual(requests, [
      {
        method: "pinChatMessage",
        body: {
          chat_id: "chat-1",
          message_id: 123,
          disable_notification: true
        }
      },
      {
        method: "unpinChatMessage",
        body: {
          chat_id: "chat-1",
          message_id: 123
        }
      }
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
