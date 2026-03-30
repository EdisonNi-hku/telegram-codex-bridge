import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlatformChatRef,
  isSamePlatformChatRef,
  resolvePlatformBindingRef,
  resolvePlatformChatRef,
  resolvePlatformUserRef
} from "./binding.js";

test("resolvePlatformUserRef prefers neutral user fields and falls back to compatibility mirrors", () => {
  assert.deepEqual(
    resolvePlatformUserRef({
      userId: "user-neutral",
      username: "neutral"
    }),
    {
      platform: "telegram",
      userId: "user-neutral",
      username: "neutral"
    }
  );

  assert.deepEqual(
    resolvePlatformUserRef({
      telegramUserId: "user-legacy",
      telegramUsername: "legacy"
    }),
    {
      platform: "telegram",
      userId: "user-legacy",
      username: "legacy"
    }
  );
});

test("resolvePlatformChatRef falls back to compatibility chat fields", () => {
  assert.deepEqual(
    resolvePlatformChatRef({
      telegramChatId: "chat-legacy"
    }),
    {
      platform: "telegram",
      chatId: "chat-legacy"
    }
  );
});

test("resolvePlatformBindingRef combines neutral and compatibility inputs", () => {
  assert.deepEqual(
    resolvePlatformBindingRef({
      chatId: "chat-neutral",
      telegramUserId: "user-legacy"
    }),
    {
      platform: "telegram",
      chatId: "chat-neutral",
      userId: "user-legacy"
    }
  );
});

test("isSamePlatformChatRef compares platform chat identity", () => {
  assert.equal(
    isSamePlatformChatRef(
      createPlatformChatRef("chat-1"),
      {
        platform: "telegram",
        chatId: "chat-1"
      }
    ),
    true
  );

  assert.equal(
    isSamePlatformChatRef(
      createPlatformChatRef("chat-1"),
      {
        platform: "telegram",
        chatId: "chat-2"
      }
    ),
    false
  );
});
