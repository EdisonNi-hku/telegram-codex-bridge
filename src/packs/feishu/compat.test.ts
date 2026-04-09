import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FeishuTelegramApiCompat } from "../../feishu/api.js";

async function createCompat() {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-compat-"));
  const api = new FeishuTelegramApiCompat({
    appId: "cli_test",
    appSecret: "secret",
    apiBaseUrl: "https://open.feishu.cn"
  }, {
    runtimeDir: root
  });

  return {
    api,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    }
  };
}

test("feishu compat api exposes a stable telegram-like bot identity", async () => {
  const { api, cleanup } = await createCompat();

  try {
    const me = await api.getMe();

    assert.equal(me.is_bot, true);
    assert.equal(me.first_name, "Feishu");
    assert.equal(me.username, "cli_test");
  } finally {
    await cleanup();
  }
});

test("feishu compat api passes custom api base urls through to the sdk client", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-compat-"));
  const api = new FeishuTelegramApiCompat({
    appId: "cli_test",
    appSecret: "secret",
    apiBaseUrl: "https://proxy.example.test"
  }, {
    runtimeDir: root
  });

  try {
    assert.equal((api as any).client.domain, "https://proxy.example.test");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("feishu compat refs record and resolve remote ids through the api store", async () => {
  const { api, cleanup } = await createCompat();

  try {
    await api.ready();
    const refs = api.refsStore;
    const localUserId = refs.getOrCreateLocalUserId("ou_user_1");
    const localChatId = refs.getOrCreateLocalChatId("oc_chat_1");
    const localMessageId = refs.recordRemoteMessage("om_message_1", "oc_chat_1");

    assert.equal(refs.resolveRemoteUserId(localUserId), "ou_user_1");
    assert.equal(refs.resolveRemoteChatId(localChatId), "oc_chat_1");
    assert.deepEqual(refs.resolveRemoteMessage(localMessageId), {
      remoteMessageId: "om_message_1",
      remoteChatId: "oc_chat_1"
    });
  } finally {
    await cleanup();
  }
});

test("feishu compat sendDocument does not fail after the file is already delivered when caption follow-up fails", async () => {
  const { api, cleanup } = await createCompat();
  const tempFile = join(tmpdir(), `ctb-feishu-caption-${Date.now()}.pdf`);

  try {
    await writeFile(tempFile, "stub", "utf8");
    await api.ready();
    const refs = api.refsStore;
    const localChatId = refs.getOrCreateLocalChatId("oc_chat_1");
    (api as any).sendMessage = async () => {
      throw new Error("caption send failed");
    };
    (api as any).client = {
      im: {
        v1: {
          file: {
            create: async () => ({ file_key: "file_key_1" })
          },
          message: {
            create: async () => ({
              data: {
                message_id: "om_file_1"
              }
            })
          }
        }
      }
    };

    const sent = await api.sendDocument(`${localChatId}`, tempFile, {
      caption: "hello"
    });

    assert.equal(sent.message_id > 0, true);
    assert.equal(sent.caption, "hello");
    assert.deepEqual(refs.resolveRemoteMessage(sent.message_id), {
      remoteMessageId: "om_file_1",
      remoteChatId: "oc_chat_1"
    });
  } finally {
    await rm(tempFile, { force: true });
    await cleanup();
  }
});

test("feishu compat edit fallback deletes the previous remote card after replacement", async () => {
  const { api, cleanup } = await createCompat();

  try {
    await api.ready();
    const refs = api.refsStore;
    const localChatId = refs.getOrCreateLocalChatId("oc_chat_1");
    const localMessageId = refs.recordRemoteMessage("om_old", "oc_chat_1");
    const deleted: string[] = [];
    (api as any).client = {
      im: {
        v1: {
          message: {
            patch: async () => ({ code: 1, msg: "too old" }),
            create: async () => ({
              data: {
                message_id: "om_new"
              }
            }),
            delete: async ({ path }: { path: { message_id: string } }) => {
              deleted.push(path.message_id);
              return { code: 0 };
            }
          }
        }
      }
    };

    const sent = await api.editMessageText(`${localChatId}`, localMessageId, "updated");

    assert.equal(sent.message_id, localMessageId);
    assert.deepEqual(deleted, ["om_old"]);
    assert.deepEqual(refs.resolveRemoteMessage(localMessageId), {
      remoteMessageId: "om_new",
      remoteChatId: "oc_chat_1"
    });
  } finally {
    await cleanup();
  }
});

test("feishu compat translates known interactive card access errors into operator guidance", async () => {
  const { api, cleanup } = await createCompat();

  try {
    await api.ready();
    const refs = api.refsStore;
    const localChatId = refs.getOrCreateLocalChatId("oc_chat_1");
    (api as any).client = {
      im: {
        v1: {
          message: {
            create: async () => ({
              code: 200340,
              msg: "access not configured"
            })
          }
        }
      }
    };

    await assert.rejects(
      api.sendMessage(`${localChatId}`, "hello", {
        replyMarkup: {
          inline_keyboard: [[{
            text: "Pick",
            callback_data: "v1:pick:demo"
          }]]
        }
      }),
      /200340.*card\.action\.trigger.*published/u
    );
  } finally {
    await cleanup();
  }
});
