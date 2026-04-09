import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import type { Logger } from "../logger.js";
import type { BridgePackName } from "../packs/names.js";
import type { BridgePaths } from "../paths.js";
import type { TelegramApi, TelegramDocument, TelegramMessage } from "../telegram/api.js";
import type {
  BridgeMediaDescriptor,
  BridgeMediaKind,
  InboundUserMediaEvent,
  ResolvedMediaAsset
} from "../core/interaction-model/media.js";
import { normalizeWhitespace } from "../util/text.js";

const BRIDGE_MEDIA_CACHE_DIRNAME = "bridge-media";
const TELEGRAM_IMAGE_CACHE_DIRNAME = "telegram-images";
const BRIDGE_MEDIA_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PlatformResourceDownloadRequest {
  messageId: string;
  resourceId: string;
  resourceType: string;
  destinationPath: string;
}

export interface MediaCapableApi extends Pick<TelegramApi, "getFile" | "downloadFile"> {
  downloadMessageResource?: (request: PlatformResourceDownloadRequest) => Promise<string | null>;
}

export interface BridgeInboundMedia {
  kind: BridgeMediaKind;
  resourceId: string;
  fileName?: string | undefined;
  mimeType?: string | undefined;
  sizeBytes?: number | undefined;
  platformRef: {
    platform: BridgePackName;
    conversationId: string;
    messageId: string;
    resourceType: string;
  };
}

interface MediaIngressServiceDeps {
  logger: Logger;
  paths: Pick<BridgePaths, "cacheDir">;
  getApi: () => MediaCapableApi | null;
}

export class MediaIngressService {
  constructor(private readonly deps: MediaIngressServiceDeps) {}

  async resolveMessageMedia(message: TelegramMessage, activePack: BridgePackName): Promise<InboundUserMediaEvent | null> {
    const api = this.deps.getApi();
    if (!api) {
      return null;
    }

    const descriptors = this.extractInboundMedia(message, activePack);
    if (descriptors.length === 0) {
      return null;
    }

    const media = await Promise.all(descriptors.map(async (descriptor) => await this.resolveDescriptor(descriptor, api)));
    return {
      text: extractInboundText(message),
      media
    };
  }

  private extractInboundMedia(message: TelegramMessage, activePack: BridgePackName): BridgeMediaDescriptor[] {
    const descriptors: BridgeMediaDescriptor[] = [];

    if (Array.isArray(message.bridgeMedia) && message.bridgeMedia.length > 0) {
      for (const media of message.bridgeMedia) {
        descriptors.push({
          kind: media.kind,
          role: "user_input",
          source: "platform_resource",
          ...(media.mimeType ? { mimeType: media.mimeType } : {}),
          ...(media.fileName ? { filename: media.fileName } : {}),
          ...(media.sizeBytes !== undefined ? { sizeBytes: media.sizeBytes } : {}),
          platformRef: {
            platform: media.platformRef.platform,
            conversationId: media.platformRef.conversationId,
            messageId: media.platformRef.messageId,
            resourceId: media.resourceId,
            resourceType: media.platformRef.resourceType
          }
        });
      }
      return descriptors;
    }

    const chatId = `${message.chat.id}`;
    const messageId = `${message.message_id}`;
    const photo = message.photo?.at(-1);
    if (photo) {
      descriptors.push({
        kind: "image",
        role: "user_input",
        source: "platform_resource",
        ...(photo.file_size !== undefined ? { sizeBytes: photo.file_size } : {}),
        platformRef: {
          platform: activePack,
          conversationId: chatId,
          messageId,
          resourceId: photo.file_id,
          resourceType: "photo"
        }
      });
    }

    const document = message.document;
    if (document) {
      descriptors.push(this.buildDocumentDescriptor(document, {
        platform: activePack,
        conversationId: chatId,
        messageId
      }));
    }

    return descriptors;
  }

  private buildDocumentDescriptor(
    document: TelegramDocument,
    platformRef: {
      platform: BridgePackName;
      conversationId: string;
      messageId: string;
    }
  ): BridgeMediaDescriptor {
    const extension = extname(document.file_name ?? "").toLowerCase();
    const mimeType = document.mime_type ?? undefined;
    const imageLike = (mimeType?.startsWith("image/") ?? false)
      || [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".heic", ".heif"].includes(extension);

    return {
      kind: imageLike ? "image" : "file",
      role: "user_input",
      source: "platform_resource",
      ...(mimeType ? { mimeType } : {}),
      ...(document.file_name ? { filename: document.file_name } : {}),
      ...(document.file_size !== undefined ? { sizeBytes: document.file_size } : {}),
      platformRef: {
        ...platformRef,
        resourceId: document.file_id,
        resourceType: "document"
      }
    };
  }

  private async resolveDescriptor(
    descriptor: BridgeMediaDescriptor,
    api: MediaCapableApi
  ): Promise<ResolvedMediaAsset> {
    const platformRef = descriptor.platformRef;
    if (!platformRef) {
      return this.buildUnresolvedAsset(descriptor, "missing_platform_ref");
    }

    const cacheDir = await this.ensureMediaCacheDir(descriptor);
    const destinationPath = join(cacheDir, this.buildCacheFileName(descriptor));

    try {
      const resolvedPath = platformRef.platform === "feishu"
        ? await api.downloadMessageResource?.({
          messageId: platformRef.messageId,
          resourceId: platformRef.resourceId,
          resourceType: platformRef.resourceType === "document" ? "file" : platformRef.resourceType,
          destinationPath
        }) ?? null
        : await this.downloadTelegramResource(api, platformRef.resourceId, destinationPath);

      if (!resolvedPath) {
        return this.buildUnresolvedAsset(descriptor, "resource_unavailable");
      }

      const fileBuffer = await readFile(resolvedPath);
      const fileStats = await stat(resolvedPath);
      return {
        descriptor: {
          ...descriptor,
          sizeBytes: descriptor.sizeBytes ?? fileStats.size
        },
        status: "resolved",
        localPath: resolvedPath,
        sha256: createHash("sha256").update(fileBuffer).digest("hex"),
        resolvedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + BRIDGE_MEDIA_CACHE_TTL_MS).toISOString()
      };
    } catch (error) {
      await this.deps.logger.warn("media resource resolution failed", {
        platform: platformRef.platform,
        messageId: platformRef.messageId,
        resourceId: platformRef.resourceId,
        resourceType: platformRef.resourceType,
        error: `${error}`
      });
      return this.buildUnresolvedAsset(descriptor, "download_failed");
    }
  }

  private async downloadTelegramResource(
    api: Pick<MediaCapableApi, "getFile" | "downloadFile">,
    fileId: string,
    destinationPath: string
  ): Promise<string | null> {
    const file = await api.getFile(fileId);
    if (!file.file_path) {
      return null;
    }

    return await api.downloadFile(fileId, destinationPath, file);
  }

  private buildUnresolvedAsset(descriptor: BridgeMediaDescriptor, failureReason: string): ResolvedMediaAsset {
    return {
      descriptor,
      status: "unresolved",
      localPath: null,
      sha256: null,
      resolvedAt: null,
      expiresAt: null,
      failureReason
    };
  }

  private async ensureMediaCacheDir(descriptor: BridgeMediaDescriptor): Promise<string> {
    const cacheDir = join(
      this.deps.paths.cacheDir,
      descriptor.platformRef?.platform === "telegram" && descriptor.kind === "image"
        ? TELEGRAM_IMAGE_CACHE_DIRNAME
        : BRIDGE_MEDIA_CACHE_DIRNAME
    );
    await mkdir(cacheDir, { recursive: true });
    return cacheDir;
  }

  private buildCacheFileName(descriptor: BridgeMediaDescriptor): string {
    const platformRef = descriptor.platformRef;
    const extension = this.detectFileExtension(descriptor);
    if (platformRef?.platform === "telegram" && descriptor.kind === "image") {
      return `${platformRef.messageId}-${randomUUID()}${extension}`;
    }

    return `${platformRef?.platform ?? "bridge"}-${platformRef?.messageId ?? "media"}-${randomUUID()}${extension}`;
  }

  private detectFileExtension(descriptor: BridgeMediaDescriptor): string {
    const filename = descriptor.filename ? basename(descriptor.filename) : "";
    const filenameExtension = extname(filename).toLowerCase();
    if (filenameExtension) {
      return filenameExtension;
    }

    if (descriptor.mimeType === "image/png") {
      return ".png";
    }
    if (descriptor.mimeType === "image/webp") {
      return ".webp";
    }
    if (descriptor.mimeType?.startsWith("image/")) {
      return ".jpg";
    }
    return descriptor.kind === "image" ? ".jpg" : ".bin";
  }
}

function extractInboundText(message: TelegramMessage): string | null {
  const text = normalizeWhitespace((message.caption ?? message.text ?? "").trim());
  return text.length > 0 ? text : null;
}
