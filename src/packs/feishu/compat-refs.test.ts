import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FeishuCompatRefs } from "./compat-refs.js";

test("feishu compat refs persist local ids across reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-refs-"));

  try {
    const first = new FeishuCompatRefs({
      runtimeDir: root
    });
    await first.ready();
    const localUserId = first.getOrCreateLocalUserId("ou_user_1");
    const localChatId = first.getOrCreateLocalChatId("oc_chat_1");
    first.rememberUserChat("ou_user_1", "oc_chat_1");
    const localMessageId = first.recordRemoteMessage("om_message_1", "oc_chat_1");

    const second = new FeishuCompatRefs({
      runtimeDir: root
    });
    await second.ready();
    assert.equal(second.resolveRemoteUserId(localUserId), "ou_user_1");
    assert.equal(second.resolveRemoteChatId(localChatId), "oc_chat_1");
    assert.equal(second.resolveLocalChatIdForRemoteUser("ou_user_1"), localChatId);
    assert.deepEqual(second.resolveRemoteMessage(localMessageId), {
      remoteMessageId: "om_message_1",
      remoteChatId: "oc_chat_1"
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("feishu compat refs merge appended mappings from concurrent live writers", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-refs-"));

  try {
    const first = new FeishuCompatRefs({
      runtimeDir: root
    });
    const second = new FeishuCompatRefs({
      runtimeDir: root
    });
    await Promise.all([first.ready(), second.ready()]);

    const firstMessageId = first.recordRemoteMessage("om_message_1", "oc_chat_1");
    const secondMessageId = second.recordRemoteMessage("om_message_2", "oc_chat_2");

    const reopened = new FeishuCompatRefs({
      runtimeDir: root
    });
    await reopened.ready();

    assert.deepEqual(reopened.resolveRemoteMessage(firstMessageId), {
      remoteMessageId: "om_message_1",
      remoteChatId: "oc_chat_1"
    });
    assert.deepEqual(reopened.resolveRemoteMessage(secondMessageId), {
      remoteMessageId: "om_message_2",
      remoteChatId: "oc_chat_2"
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("feishu compat refs remember the latest p2p chat for a user", async () => {
  const root = await mkdtemp(join(tmpdir(), "ctb-feishu-refs-"));

  try {
    const refs = new FeishuCompatRefs({
      runtimeDir: root
    });
    await refs.ready();

    const firstChatId = refs.getOrCreateLocalChatId("oc_chat_1");
    refs.getOrCreateLocalUserId("ou_user_1");
    refs.rememberUserChat("ou_user_1", "oc_chat_1");

    assert.equal(refs.resolveLocalChatIdForRemoteUser("ou_user_1"), firstChatId);

    const secondChatId = refs.getOrCreateLocalChatId("oc_chat_2");
    refs.rememberUserChat("ou_user_1", "oc_chat_2");

    assert.equal(refs.resolveLocalChatIdForRemoteUser("ou_user_1"), secondChatId);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
