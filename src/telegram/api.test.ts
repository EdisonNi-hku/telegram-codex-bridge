import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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

async function waitForFileIn(directory: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const entries = await readdir(directory);
    if (entries.length > 0) {
      return join(directory, entries[0]!);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for a file in ${directory}`);
}

test("TelegramApi streams fetch downloads before the response completes", async () => {
  const originalFetch = globalThis.fetch;
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-stream-download-"));
  const destinationPath = join(root, "download.bin");
  let releaseSecondChunk!: () => void;
  const secondChunkReady = new Promise<void>((resolve) => {
    releaseSecondChunk = resolve;
  });

  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    body: new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(Buffer.from("first-chunk"));
        await secondChunkReady;
        controller.enqueue(Buffer.from("-second-chunk"));
        controller.close();
      }
    }),
    arrayBuffer: async () => {
      throw new Error("download must not buffer with arrayBuffer");
    }
  })) as unknown as typeof fetch;

  try {
    await withEnvironment({
      HTTPS_PROXY: undefined,
      https_proxy: undefined,
      HTTP_PROXY: undefined,
      http_proxy: undefined,
      ALL_PROXY: undefined,
      all_proxy: undefined
    }, async () => {
      const api = new TelegramApi("test-token", "https://api.telegram.org");
      const download = api.downloadFile("file-1", destinationPath, { file_id: "file-1", file_path: "payload.bin" });
      const tempPath = await waitForFileIn(root);

      assert.notEqual(tempPath, destinationPath);
      assert.equal(await readFile(tempPath, "utf8"), "first-chunk");

      releaseSecondChunk();
      assert.equal(await download, destinationPath);
      assert.equal(await readFile(destinationPath, "utf8"), "first-chunk-second-chunk");
    });
  } finally {
    releaseSecondChunk();
    globalThis.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});

test("TelegramApi creates completed downloads with owner-only permissions on POSIX", {
  skip: process.platform === "win32"
}, async () => {
  const originalFetch = globalThis.fetch;
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-download-mode-"));
  const destinationPath = join(root, "secret.bin");
  globalThis.fetch = (async () => new Response("secret-bytes")) as typeof fetch;

  try {
    await withEnvironment({
      HTTPS_PROXY: undefined,
      https_proxy: undefined,
      HTTP_PROXY: undefined,
      http_proxy: undefined,
      ALL_PROXY: undefined,
      all_proxy: undefined
    }, async () => {
      const api = new TelegramApi("test-token", "https://api.telegram.org");
      await api.downloadFile("file-2", destinationPath, { file_id: "file-2", file_path: "secret.bin" });
      assert.equal((await stat(destinationPath)).mode & 0o777, 0o600);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});

test("TelegramApi removes temporary and destination files when fetch and curl downloads fail", async () => {
  const originalFetch = globalThis.fetch;
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-download-cleanup-"));
  const binDir = join(root, "bin");
  const downloadDir = join(root, "downloads");
  const destinationPath = join(downloadDir, "failed.bin");
  await mkdir(binDir);
  await mkdir(downloadDir);
  await writeCurlStub(binDir);
  globalThis.fetch = (async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Buffer.from("partial-download"));
      controller.error(new Error("fetch stream failed"));
    }
  }))) as typeof fetch;

  try {
    const pathValue = process.platform === "win32"
      ? `${binDir};${process.env.PATH ?? ""}`
      : `${binDir}:${process.env.PATH ?? ""}`;
    await withEnvironment({
      PATH: pathValue,
      HTTPS_PROXY: undefined,
      https_proxy: undefined,
      HTTP_PROXY: undefined,
      http_proxy: undefined,
      ALL_PROXY: undefined,
      all_proxy: undefined
    }, async () => {
      const api = new TelegramApi("test-token", "https://api.telegram.org");
      await assert.rejects(
        api.downloadFile("file-3", destinationPath, { file_id: "file-3", file_path: "failed.bin" }),
        /fetch stream failed.*curl transport failed/isu
      );
      assert.deepEqual(await readdir(downloadDir), []);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});

test("TelegramApi surfaces curl transport failures before JSON parsing", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-test-"));
  const binDir = join(root, "bin");
  const operations: unknown[] = [];

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
        const api = new TelegramApi("test-token", "https://api.telegram.org", {
          performanceRecorder: {
            recordOperation: async (event: unknown) => {
              operations.push(event);
            }
          }
        } as any);

        await assert.rejects(api.getMe(), (error: unknown) => {
          const message = String(error);
          assert.match(message, /curl transport failed/u);
          assert.doesNotMatch(message, /Unexpected end of JSON input/u);
          return true;
        });

        assert.equal(operations.length, 1);
        assert.match(JSON.stringify(operations[0]), /"category":"telegram_api"/u);
        assert.match(JSON.stringify(operations[0]), /"name":"getMe"/u);
        assert.match(JSON.stringify(operations[0]), /"outcome":"error"/u);
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

test("TelegramApi records successful fetch operations", async () => {
  const operations: unknown[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      result: {
        id: 1,
        is_bot: true,
        first_name: "BridgeBot"
      }
    })
  })) as unknown as typeof fetch;

  try {
    await withEnvironment({
      HTTPS_PROXY: undefined,
      https_proxy: undefined,
      HTTP_PROXY: undefined,
      http_proxy: undefined,
      ALL_PROXY: undefined,
      all_proxy: undefined
    }, async () => {
      const api = new TelegramApi("test-token", "https://api.telegram.org", {
        performanceRecorder: {
          recordOperation: async (event: unknown) => {
            operations.push(event);
          }
        }
      } as any);

      const user = await api.getMe();

      assert.equal(user.id, 1);
      assert.equal(operations.length, 1);
      assert.match(JSON.stringify(operations[0]), /"category":"telegram_api"/u);
      assert.match(JSON.stringify(operations[0]), /"name":"getMe"/u);
      assert.match(JSON.stringify(operations[0]), /"transport":"fetch"/u);
      assert.match(JSON.stringify(operations[0]), /"outcome":"ok"/u);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TelegramApi sends document uploads with expected form fields", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ url: string; method: string; chatId: string | null; caption: string | null; parseMode: string | null }> = [];
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-send-document-"));
  const filePath = join(root, "report.txt");

  await writeFile(filePath, "hello-report", "utf8");

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    fetchCalls.push({
      url: String(url),
      method: init?.method ?? "GET",
      chatId: String(form.get("chat_id")),
      caption: String(form.get("caption")),
      parseMode: String(form.get("parse_mode"))
    });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          message_id: 42,
          date: 0,
          chat: { id: 1, type: "private" }
        }
      })
    } as Response;
  }) as typeof fetch;

  try {
    await withEnvironment({
      HTTPS_PROXY: undefined,
      https_proxy: undefined,
      HTTP_PROXY: undefined,
      http_proxy: undefined,
      ALL_PROXY: undefined,
      all_proxy: undefined
    }, async () => {
      const api = new TelegramApi("test-token", "https://api.telegram.org");
      const result = await (api as any).sendDocument("chat-1", filePath, {
        caption: "Here you go",
        parseMode: "HTML",
        fileName: "export.txt"
      });
      assert.equal(result.message_id, 42);
    });

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.method, "POST");
    assert.match(fetchCalls[0]?.url ?? "", /\/sendDocument$/u);
    assert.equal(fetchCalls[0]?.chatId, "chat-1");
    assert.equal(fetchCalls[0]?.caption, "Here you go");
    assert.equal(fetchCalls[0]?.parseMode, "HTML");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});

test("TelegramApi fetch upload keeps the document body file-backed until consumed", async () => {
  const originalFetch = globalThis.fetch;
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-lazy-document-"));
  const filePath = join(root, "large-report.bin");
  await writeFile(filePath, "original-bytes", "utf8");

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    const document = form.get("document");
    assert.ok(document instanceof Blob);
    await writeFile(filePath, "changed bytes with a different size", "utf8");
    await assert.rejects(document.arrayBuffer(), /modified|read|state|NotReadable/iu);
    return {
      ok: true,
      json: async () => ({
        ok: true,
        result: { message_id: 43, date: 0, chat: { id: 1, type: "private" } }
      })
    } as Response;
  }) as typeof fetch;

  try {
    await withEnvironment({
      HTTPS_PROXY: undefined,
      https_proxy: undefined,
      HTTP_PROXY: undefined,
      http_proxy: undefined,
      ALL_PROXY: undefined,
      all_proxy: undefined
    }, async () => {
      const api = new TelegramApi("test-token", "https://api.telegram.org");
      const result = await api.sendDocument("chat-1", filePath, { fileName: "large-report.bin" });
      assert.equal(result.message_id, 43);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});

test("TelegramApi curl upload quotes filename directives as literal filename text", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-curl-filename-"));
  const filePath = join(root, "report.txt");
  const requestBodies: string[] = [];
  await writeFile(filePath, "document body", "utf8");

  const server = createServer(async (req, res) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    requestBodies.push(Buffer.concat(chunks).toString("utf8"));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      result: { message_id: 44, date: 0, chat: { id: 1, type: "private" } }
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    const api = new TelegramApi("test-token", `http://127.0.0.1:${address.port}`);
    const fileName = '报告 Q1;headers="X-Injection: yes";headers=@/definitely/missing;type=text/x-evil;filename="override"\\tail.txt';
    const result = await (api as any).sendDocumentWithCurl(
      "chat-1",
      filePath,
      { fileName },
      20_000,
      new Error("forced fetch failure")
    );

    assert.equal(result.message_id, 44);
    assert.equal(requestBodies.length, 1);
    assert.doesNotMatch(requestBodies[0] ?? "", /\r\nX-Injection: yes\r\n/u);
    assert.doesNotMatch(requestBodies[0] ?? "", /\r\nContent-Type: text\/x-evil\r\n/u);
    assert.match(requestBodies[0] ?? "", /报告 Q1;headers=/u);
    assert.match(requestBodies[0] ?? "", /headers=@\/definitely\/missing/u);
    assert.match(requestBodies[0] ?? "", /override/u);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await rm(root, { recursive: true, force: true });
  }
});

test("TelegramApi rejects curl multipart filenames containing CR, LF, or NUL", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-curl-control-filename-"));
  const filePath = join(root, "report.txt");
  await writeFile(filePath, "document body", "utf8");
  const api = new TelegramApi("test-token", "http://127.0.0.1:1");

  try {
    for (const fileName of ["bad\rname.txt", "bad\nname.txt", "bad\0name.txt"]) {
      await assert.rejects(
        (api as any).sendDocumentWithCurl("chat-1", filePath, { fileName }, 20_000, "test"),
        /filename.*(?:CR|LF|NUL|control)/iu
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("TelegramApi falls back to curl when a file-backed fetch body detects mutation", async () => {
  const originalFetch = globalThis.fetch;
  const root = await mkdtemp(join(tmpdir(), "ctb-telegram-api-mutated-fallback-"));
  const filePath = join(root, "report.txt");
  await writeFile(filePath, "original", "utf8");

  const server = createServer(async (req, res) => {
    for await (const _chunk of req) {
      // Consume the curl fallback request.
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      result: { message_id: 45, date: 0, chat: { id: 1, type: "private" } }
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    const document = form.get("document");
    assert.ok(document instanceof Blob);
    await writeFile(filePath, "mutated!", "utf8");
    await document.arrayBuffer();
    throw new Error("expected file-backed blob mutation detection");
  }) as typeof fetch;

  try {
    await withEnvironment({
      HTTPS_PROXY: undefined,
      https_proxy: undefined,
      HTTP_PROXY: undefined,
      http_proxy: undefined,
      ALL_PROXY: undefined,
      all_proxy: undefined
    }, async () => {
      const api = new TelegramApi("test-token", `http://127.0.0.1:${address.port}`);
      const result = await api.sendDocument("chat-1", filePath, { fileName: "report.txt" });
      assert.equal(result.message_id, 45);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await rm(root, { recursive: true, force: true });
  }
});
