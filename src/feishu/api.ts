import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";

import * as Lark from "@larksuiteoapi/node-sdk";

import type { FeishuPackConfig } from "../packs/feishu/config.js";
import { FeishuCompatRefs } from "../packs/feishu/compat-refs.js";
import type {
  TelegramBotCommand,
  TelegramBotCommandScope,
  TelegramFile,
  TelegramInlineKeyboardMarkup,
  TelegramMessage,
  TelegramUser
} from "../telegram/api.js";
import type { BridgePaths } from "../paths.js";

export function resolveFeishuSdkDomain(apiBaseUrl: string): string {
  return apiBaseUrl;
}

function buildFeishuClient(config: FeishuPackConfig) {
  return new Lark.Client({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: resolveFeishuSdkDomain(config.apiBaseUrl)
  });
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gu, " ")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, "&");
}

function htmlToLarkMarkdown(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/giu, "\n")
      .replace(/<\/p>/giu, "\n\n")
      .replace(/<p[^>]*>/giu, "")
      .replace(/<(strong|b)>/giu, "**")
      .replace(/<\/(strong|b)>/giu, "**")
      .replace(/<(em|i)>/giu, "*")
      .replace(/<\/(em|i)>/giu, "*")
      .replace(/<code>/giu, "`")
      .replace(/<\/code>/giu, "`")
      .replace(/<pre[^>]*>/giu, "```\n")
      .replace(/<\/pre>/giu, "\n```")
      .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/giu, "[$2]($1)")
      .replace(/<[^>]+>/gu, "")
  ).trim();
}

function buildInteractiveCard(
  html: string,
  replyMarkup?: TelegramInlineKeyboardMarkup
): string {
  const content = htmlToLarkMarkdown(html) || "-";
  const elements: Array<Record<string, unknown>> = [{
    tag: "markdown",
    content
  }];

  for (const row of replyMarkup?.inline_keyboard ?? []) {
    elements.push({
      tag: "action",
      layout: row.length >= 3 ? "trisection" : row.length === 2 ? "bisected" : "flow",
      actions: row.map((button) => ({
        tag: "button",
        type: button.style ?? "default",
        text: {
          tag: "plain_text",
          content: button.text
        },
        value: {
          callback_data: button.callback_data
        }
      }))
    });
  }

  return JSON.stringify({
    config: {
      wide_screen_mode: true,
      update_multi: true,
      enable_forward: true
    },
    elements
  });
}

interface FeishuObservationRecorder {
  recordInteractiveCardDelivered?(payload?: {
    messageId?: string | null;
  }): void;
  recordInteractiveCardFailed?(payload: {
    code?: number | null;
    message?: string | null;
  }): void;
}

export interface FeishuApiErrorDetails {
  code: number | null;
  msg: string | null;
  logId: string | null;
  permissionViolations: string[];
}

function formatFeishuApiError(
  action: string,
  response: {
    code?: number | undefined;
    msg?: string | undefined;
  },
  options?: {
    interactive?: boolean;
  }
): string {
  const codeText = typeof response.code === "number" ? ` (code ${response.code})` : "";
  const detail = typeof response.msg === "string" && response.msg.trim().length > 0
    ? response.msg.trim()
    : "unknown";

  if (options?.interactive && response.code === 200340) {
    return `${action}${codeText}: ${detail}. Feishu interactive card access is not fully configured; verify card.action.trigger is enabled, long connection is on, and the latest app version is published.`;
  }

  return `${action}${codeText}: ${detail}`;
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function getNestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return asObjectRecord(record[key]);
}

function getNestedString(record: Record<string, unknown>, key: string): string | null {
  return typeof record[key] === "string" ? record[key] as string : null;
}

function getNestedNumber(record: Record<string, unknown>, key: string): number | null {
  return typeof record[key] === "number" ? record[key] as number : null;
}

export function extractFeishuSdkErrorDetails(error: unknown): FeishuApiErrorDetails | null {
  const errorRecord = asObjectRecord(error);
  const responseRecord = errorRecord ? getNestedRecord(errorRecord, "response") : null;
  const dataRecord = responseRecord ? getNestedRecord(responseRecord, "data") : null;
  if (!dataRecord) {
    return null;
  }

  const code = getNestedNumber(dataRecord, "code");
  const msg = getNestedString(dataRecord, "msg");
  const errorDetails = getNestedRecord(dataRecord, "error");
  const logId = errorDetails ? getNestedString(errorDetails, "log_id") : null;
  const violations = Array.isArray(errorDetails?.permission_violations)
    ? errorDetails.permission_violations
      .map((entry) => asObjectRecord(entry))
      .map((entry) => entry ? getNestedString(entry, "subject") : null)
      .filter((value): value is string => Boolean(value))
    : [];

  return {
    code,
    msg,
    logId,
    permissionViolations: violations
  };
}

function formatFeishuSdkError(action: string, error: unknown): string | null {
  const details = extractFeishuSdkErrorDetails(error);
  if (!details) {
    return null;
  }

  const base = formatFeishuApiError(action, {
    ...(details.code === null ? {} : { code: details.code }),
    ...(details.msg === null ? {} : { msg: details.msg })
  });
  if (details.code === 99991672 && details.permissionViolations.length > 0) {
    return `${base}. Missing Feishu app scopes: ${details.permissionViolations.join(", ")}. Grant one of the required upload scopes in the Feishu app and publish the latest app version.${details.logId ? ` log_id=${details.logId}` : ""}`;
  }

  return details.logId ? `${base}. log_id=${details.logId}` : base;
}

function detectFeishuFileType(filePath: string): "opus" | "mp4" | "pdf" | "doc" | "xls" | "ppt" | "stream" {
  switch (extname(filePath).toLowerCase()) {
    case ".opus":
      return "opus";
    case ".mp4":
      return "mp4";
    case ".pdf":
      return "pdf";
    case ".doc":
    case ".docx":
      return "doc";
    case ".xls":
    case ".xlsx":
      return "xls";
    case ".ppt":
    case ".pptx":
      return "ppt";
    default:
      return "stream";
  }
}

function buildTelegramLikeMessage(options: {
  localMessageId: number;
  localChatId: number;
  text?: string;
  caption?: string;
}): TelegramMessage {
  return {
    message_id: options.localMessageId,
    chat: {
      id: options.localChatId,
      type: "private"
    },
    date: Math.floor(Date.now() / 1000),
    ...(options.text ? { text: options.text } : {}),
    ...(options.caption ? { caption: options.caption } : {})
  };
}

export class FeishuTelegramApiCompat {
  private readonly client;
  private readonly refs: FeishuCompatRefs;
  private observationRecorder: FeishuObservationRecorder | null = null;

  constructor(
    private readonly config: FeishuPackConfig,
    paths: Pick<BridgePaths, "runtimeDir">
  ) {
    this.client = buildFeishuClient(config);
    this.refs = new FeishuCompatRefs(paths);
  }

  async ready(): Promise<void> {
    await this.refs.ready();
  }

  get refsStore(): FeishuCompatRefs {
    return this.refs;
  }

  setObservationRecorder(recorder: FeishuObservationRecorder): void {
    this.observationRecorder = recorder;
  }

  async getMe(): Promise<TelegramUser> {
    await this.refs.ready();
    const localUserId = this.refs.getOrCreateLocalUserId(`app:${this.config.appId}`);
    return {
      id: localUserId,
      is_bot: true,
      first_name: "Feishu",
      username: this.config.appId
    };
  }

  async sendMessage(
    chatId: string,
    text: string,
    options?: {
      replyMarkup?: TelegramInlineKeyboardMarkup;
      parseMode?: "HTML";
    }
  ): Promise<TelegramMessage> {
    await this.refs.ready();
    const remoteChatId = this.requireRemoteChatId(chatId);
    if (options?.replyMarkup || options?.parseMode === "HTML") {
      const response = await this.client.im.v1.message.create({
        params: {
          receive_id_type: "chat_id"
        },
        data: {
          receive_id: remoteChatId,
          msg_type: "interactive",
          content: buildInteractiveCard(text, options?.replyMarkup)
        }
      });
      const remoteMessageId = response.data?.message_id;
      if (!remoteMessageId) {
        this.observationRecorder?.recordInteractiveCardFailed?.({
          code: response.code ?? null,
          message: response.msg ?? null
        });
        throw new Error(formatFeishuApiError("Feishu send interactive message failed", response, {
          interactive: true
        }));
      }
      this.observationRecorder?.recordInteractiveCardDelivered?.({
        messageId: remoteMessageId
      });
      const localMessageId = this.refs.recordRemoteMessage(remoteMessageId, remoteChatId);
      return buildTelegramLikeMessage({
        localMessageId,
        localChatId: Number.parseInt(chatId, 10),
        text
      });
    }

    const response = await this.client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id"
      },
      data: {
        receive_id: remoteChatId,
        msg_type: "text",
        content: JSON.stringify({
          text
        })
      }
    });
    const remoteMessageId = response.data?.message_id;
    if (!remoteMessageId) {
      throw new Error(formatFeishuApiError("Feishu send text message failed", response));
    }
    const localMessageId = this.refs.recordRemoteMessage(remoteMessageId, remoteChatId);
    return buildTelegramLikeMessage({
      localMessageId,
      localChatId: Number.parseInt(chatId, 10),
      text
    });
  }

  async sendPhoto(
    chatId: string,
    photoPath: string,
    options?: {
      caption?: string;
      parseMode?: "HTML";
    }
  ): Promise<TelegramMessage> {
    try {
      await this.refs.ready();
      const remoteChatId = this.requireRemoteChatId(chatId);
      const image = await this.client.im.v1.image.create({
        data: {
          image_type: "message",
          image: createReadStream(photoPath)
        }
      });
      const imageKey = image?.image_key;
      if (!imageKey) {
        throw new Error("Feishu image upload failed");
      }
      const response = await this.client.im.v1.message.create({
        params: {
          receive_id_type: "chat_id"
        },
        data: {
          receive_id: remoteChatId,
          msg_type: "image",
          content: JSON.stringify({
            image_key: imageKey
          })
        }
      });
      const remoteMessageId = response.data?.message_id;
      if (!remoteMessageId) {
        throw new Error(formatFeishuApiError("Feishu send image failed", response));
      }
      const localMessageId = this.refs.recordRemoteMessage(remoteMessageId, remoteChatId);
      if (options?.caption) {
        await this.trySendSupplementaryCaption(chatId, options.caption, {
          ...(options.parseMode ? { parseMode: options.parseMode } : {})
        });
      }
      return buildTelegramLikeMessage({
        localMessageId,
        localChatId: Number.parseInt(chatId, 10),
        ...(options?.caption ? { caption: options.caption } : {})
      });
    } catch (error) {
      throw new Error(formatFeishuSdkError("Feishu send image failed", error) ?? `${error}`);
    }
  }

  async sendDocument(
    chatId: string,
    filePath: string,
    options?: {
      caption?: string;
      parseMode?: "HTML";
      fileName?: string;
    }
  ): Promise<TelegramMessage> {
    try {
      await this.refs.ready();
      const remoteChatId = this.requireRemoteChatId(chatId);
      const uploaded = await this.client.im.v1.file.create({
        data: {
          file_type: detectFeishuFileType(filePath),
          file_name: options?.fileName ?? basename(filePath),
          file: createReadStream(filePath)
        }
      });
      const fileKey = uploaded?.file_key;
      if (!fileKey) {
        throw new Error("Feishu file upload failed");
      }
      const response = await this.client.im.v1.message.create({
        params: {
          receive_id_type: "chat_id"
        },
        data: {
          receive_id: remoteChatId,
          msg_type: "file",
          content: JSON.stringify({
            file_key: fileKey
          })
        }
      });
      const remoteMessageId = response.data?.message_id;
      if (!remoteMessageId) {
        throw new Error(formatFeishuApiError("Feishu send file failed", response));
      }
      const localMessageId = this.refs.recordRemoteMessage(remoteMessageId, remoteChatId);
      if (options?.caption) {
        await this.trySendSupplementaryCaption(chatId, options.caption, {
          ...(options.parseMode ? { parseMode: options.parseMode } : {})
        });
      }
      return buildTelegramLikeMessage({
        localMessageId,
        localChatId: Number.parseInt(chatId, 10),
        ...(options?.caption ? { caption: options.caption } : {})
      });
    } catch (error) {
      throw new Error(formatFeishuSdkError("Feishu send file failed", error) ?? `${error}`);
    }
  }

  async editMessageText(
    chatId: string,
    messageId: number,
    text: string,
    options?: {
      parseMode?: "HTML";
      replyMarkup?: TelegramInlineKeyboardMarkup;
    }
  ): Promise<TelegramMessage> {
    await this.refs.ready();
    const remoteRef = this.refs.resolveRemoteMessage(messageId);
    const remoteChatId = this.requireRemoteChatId(chatId);
    const content = options?.replyMarkup || options?.parseMode === "HTML"
      ? buildInteractiveCard(text, options?.replyMarkup)
      : buildInteractiveCard(text);
    const previousRemoteMessageId = remoteRef?.remoteMessageId ?? null;

    if (remoteRef) {
      const response = await this.client.im.v1.message.patch({
        path: {
          message_id: remoteRef.remoteMessageId
        },
        data: {
          content
        }
      });
      if (response.code === 0) {
        return buildTelegramLikeMessage({
          localMessageId: messageId,
          localChatId: Number.parseInt(chatId, 10),
          text
        });
      }
    }

    const sent = await this.client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id"
      },
      data: {
        receive_id: remoteChatId,
        msg_type: "interactive",
        content
      }
    });
    const remoteMessageId = sent.data?.message_id;
    if (!remoteMessageId) {
      this.observationRecorder?.recordInteractiveCardFailed?.({
        code: sent.code ?? null,
        message: sent.msg ?? null
      });
      throw new Error(formatFeishuApiError("Feishu edit fallback send failed", sent, {
        interactive: true
      }));
    }
    this.observationRecorder?.recordInteractiveCardDelivered?.({
      messageId: remoteMessageId
    });
    this.refs.replaceRemoteMessage(messageId, remoteMessageId, remoteChatId);
    if (previousRemoteMessageId && previousRemoteMessageId !== remoteMessageId) {
      await this.client.im.v1.message.delete({
        path: {
          message_id: previousRemoteMessageId
        }
      }).catch(() => {});
    }
    return buildTelegramLikeMessage({
      localMessageId: messageId,
      localChatId: Number.parseInt(chatId, 10),
      text
    });
  }

  async deleteMessage(_chatId: string, messageId: number): Promise<boolean> {
    await this.refs.ready();
    const remoteRef = this.refs.resolveRemoteMessage(messageId);
    if (!remoteRef) {
      return true;
    }
    const response = await this.client.im.v1.message.delete({
      path: {
        message_id: remoteRef.remoteMessageId
      }
    });
    if (response.code === 0) {
      this.refs.removeRemoteMessage(messageId);
      return true;
    }
    return false;
  }

  async pinChatMessage(_chatId: string, _messageId: number): Promise<boolean> {
    return true;
  }

  async unpinChatMessage(_chatId: string, _messageId?: number): Promise<boolean> {
    return true;
  }

  async answerCallbackQuery(_callbackQueryId: string, _text?: string): Promise<void> {}

  async setMyCommands(
    _commands: TelegramBotCommand[],
    _scope?: TelegramBotCommandScope,
    _languageCode?: string
  ): Promise<void> {}

  async getFile(_fileId: string): Promise<TelegramFile> {
    throw new Error("Feishu media ingress is not implemented by the Telegram compatibility adapter");
  }

  async downloadMessageResource(request: {
    messageId: string;
    resourceId: string;
    resourceType: string;
    destinationPath: string;
  }): Promise<string | null> {
    await mkdir(dirname(request.destinationPath), { recursive: true });

    try {
      const resource = await this.client.im.v1.messageResource.get({
        path: {
          message_id: request.messageId,
          file_key: request.resourceId
        },
        params: {
          type: request.resourceType
        }
      });
      await resource.writeFile(request.destinationPath);
      return request.destinationPath;
    } catch (error) {
      throw new Error(formatFeishuSdkError("Feishu download message resource failed", error) ?? `${error}`);
    }
  }

  private requireRemoteChatId(localChatId: string): string {
    const remoteChatId = this.refs.resolveRemoteChatId(localChatId);
    if (!remoteChatId) {
      throw new Error(`unknown Feishu chat mapping for local chat ${localChatId}`);
    }

    return remoteChatId;
  }

  private async trySendSupplementaryCaption(
    chatId: string,
    caption: string,
    options?: {
      parseMode?: "HTML";
    }
  ): Promise<void> {
    try {
      await this.sendMessage(chatId, caption, options);
    } catch {
      // Avoid retrying and duplicating the already-delivered media payload.
    }
  }
}
