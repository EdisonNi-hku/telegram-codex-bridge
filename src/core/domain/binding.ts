export type BridgePlatform = "telegram" | "feishu";

export interface PlatformUserRef {
  platform: BridgePlatform;
  userId: string;
  username: string | null;
}

export interface PlatformChatRef {
  platform: BridgePlatform;
  chatId: string;
}

export interface PlatformBindingRef extends PlatformChatRef {
  userId: string;
}

interface PlatformUserInput {
  platform?: BridgePlatform | null | undefined;
  userId?: string | null | undefined;
  telegramUserId?: string | null | undefined;
  username?: string | null | undefined;
  telegramUsername?: string | null | undefined;
}

interface PlatformChatInput {
  platform?: BridgePlatform | null | undefined;
  chatId?: string | null | undefined;
  telegramChatId?: string | null | undefined;
}

interface PlatformBindingInput extends PlatformUserInput, PlatformChatInput {}

export function resolveBridgePlatform(platform?: BridgePlatform | null): BridgePlatform {
  return platform ?? "telegram";
}

export function createPlatformUserRef(
  userId: string,
  username: string | null,
  platform?: BridgePlatform | null
): PlatformUserRef {
  return {
    platform: resolveBridgePlatform(platform),
    userId,
    username
  };
}

export function createPlatformChatRef(
  chatId: string,
  platform?: BridgePlatform | null
): PlatformChatRef {
  return {
    platform: resolveBridgePlatform(platform),
    chatId
  };
}

export function createPlatformBindingRef(
  chatId: string,
  userId: string,
  platform?: BridgePlatform | null
): PlatformBindingRef {
  return {
    ...createPlatformChatRef(chatId, platform),
    userId
  };
}

export function resolvePlatformUserRef(input: PlatformUserInput): PlatformUserRef {
  const userId = input.userId ?? input.telegramUserId;
  if (!userId) {
    throw new Error("userId is required");
  }

  return createPlatformUserRef(
    userId,
    input.username ?? input.telegramUsername ?? null,
    input.platform
  );
}

export function resolvePlatformChatRef(input: PlatformChatInput): PlatformChatRef {
  const chatId = input.chatId ?? input.telegramChatId;
  if (!chatId) {
    throw new Error("chatId is required");
  }

  return createPlatformChatRef(chatId, input.platform);
}

export function resolvePlatformBindingRef(input: PlatformBindingInput): PlatformBindingRef {
  const chatRef = resolvePlatformChatRef(input);
  const userRef = resolvePlatformUserRef(input);
  return createPlatformBindingRef(chatRef.chatId, userRef.userId, chatRef.platform);
}

export function isSamePlatformChatRef(left: PlatformChatRef, right: PlatformChatRef): boolean {
  return left.platform === right.platform && left.chatId === right.chatId;
}
