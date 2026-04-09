import type { BridgeConfig } from "../../config.js";
import {
  createDynamicToolDeclarations,
  interpretDynamicToolRequest,
  interpretSharedServerRequest
} from "../../codex/server-request-policy.js";
import type { Logger } from "../../logger.js";
import { BridgeService } from "../../service.js";
import type { BridgeStateStore } from "../../state/store.js";
import { syncTelegramCommands } from "../../telegram/commands.js";
import { TelegramApi } from "../../telegram/api.js";
import { TELEGRAM_SURFACE_CAPABILITY_SNAPSHOT } from "../../telegram/surface-adapter.js";
import type { BridgePackDefinition, PackHealthReport } from "../contract.js";
import {
  getTelegramPackConfig,
  TELEGRAM_PACK_DISPLAY_NAME,
  TELEGRAM_PACK_SKILL_NAME,
  type TelegramPackConfig
} from "./config.js";

const TELEGRAM_DYNAMIC_TOOLS = [{
  toolName: "send_telegram_document",
  action: "send_control_surface_file",
  description: "Send a local server file to the active control surface as a document attachment.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      caption: { type: "string" },
      filename: { type: "string" }
    },
    required: ["path"]
  }
}, {
  toolName: "send_telegram_image",
  action: "send_control_surface_image",
  description: "Send a local server image to the active control surface.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      caption: { type: "string" }
    },
    required: ["path"]
  }
}] as const;

async function validateTelegramToken(token: string, baseUrl: string): Promise<{
  ok: boolean;
  username?: string;
  botId?: string;
  issue?: string;
}> {
  try {
    const api = new TelegramApi(token, baseUrl);
    const bot = await api.getMe();
    return {
      ok: true,
      ...(bot.username ? { username: bot.username } : {}),
      botId: `${bot.id}`
    };
  } catch (error) {
    return {
      ok: false,
      issue: `${error}`
    };
  }
}

function buildPackHealthReport(options: {
  config: BridgeConfig;
  store: BridgeStateStore;
  tokenValid: boolean;
  tokenIssue?: string;
  username?: string;
  botId?: string;
}): PackHealthReport {
  const missingCredentials = TELEGRAM_PACK.authBinding.describeMissingCredentials(options.config);
  const authorized = TELEGRAM_PACK.authBinding.isBound(options.store);
  const credentialsCheck = {
    id: "telegram_credentials",
    ok: missingCredentials.length === 0,
    summary: missingCredentials.length === 0 ? "telegram credentials configured" : "telegram credentials missing",
    ...(missingCredentials.length > 0 ? { missingEnv: missingCredentials } : {})
  };
  const tokenCheck = {
    id: "telegram_token_validation",
    ok: missingCredentials.length === 0 && options.tokenValid,
    summary: missingCredentials.length > 0
      ? "telegram token not checked because credentials are missing"
      : options.tokenValid
        ? "telegram bot token validated"
        : options.tokenIssue ?? "telegram bot token validation failed"
  };
  const bindingCheck = {
    id: "telegram_authorization_binding",
    ok: authorized,
    summary: authorized ? "telegram authorization is bound" : "telegram authorization is pending"
  };
  const checks = [credentialsCheck, tokenCheck, bindingCheck];
  const issues = checks.filter((check) => !check.ok).map((check) => check.summary);

  return {
    state: !credentialsCheck.ok || !tokenCheck.ok
      ? "pack_unhealthy"
      : bindingCheck.ok
        ? "ready"
        : "awaiting_authorization",
    checks,
    issues,
    metadata: {
      telegramBotUsername: options.username ?? null,
      telegramBotId: options.botId ?? null,
      mediaCanSendImage: TELEGRAM_PACK.capabilities.canSendImage,
      mediaCanSendFile: TELEGRAM_PACK.capabilities.canSendFile,
      mediaCanReceiveImage: TELEGRAM_PACK.capabilities.canReceiveImage,
      mediaCanReceiveFile: TELEGRAM_PACK.capabilities.canReceiveFile,
      mediaCanReceiveVoice: TELEGRAM_PACK.capabilities.canReceiveVoice
    }
  };
}

function interpretTelegramServerRequest(request: Parameters<typeof interpretSharedServerRequest>[0]) {
  const shared = interpretSharedServerRequest(request);
  if (shared) {
    return shared;
  }

  return interpretDynamicToolRequest(request, TELEGRAM_DYNAMIC_TOOLS);
}

export const TELEGRAM_PACK: BridgePackDefinition<TelegramPackConfig> = {
  name: "telegram",
  displayName: TELEGRAM_PACK_DISPLAY_NAME,
  skillName: TELEGRAM_PACK_SKILL_NAME,
  capabilities: TELEGRAM_SURFACE_CAPABILITY_SNAPSHOT,
  ingress: {
    kind: "polling",
    ownsCallbacks: true,
    ownsRichInput: true,
    ownsMediaIngress: true
  },
  egress: {
    kind: "bot_api",
    syncControlSurface: async ({ config }) => {
      const telegramConfig = getTelegramPackConfig(config);
      const api = new TelegramApi(telegramConfig.botToken, telegramConfig.apiBaseUrl);
      await syncTelegramCommands(api);
    }
  },
  authBinding: {
    isBound: (store) => store.getAuthorizedUser("telegram") !== null,
    describeMissingCredentials: (config) => getTelegramPackConfig(config).botToken.trim().length === 0
      ? ["TELEGRAM_BOT_TOKEN"]
      : []
  },
  install: {
    validateInstallConfig: (config) => {
      if (!getTelegramPackConfig(config).botToken.trim()) {
        throw new Error("missing Telegram bot token; pass --telegram-token or set TELEGRAM_BOT_TOKEN");
      }
    },
    shouldSyncControlSurface: (snapshot) =>
      snapshot.state !== "pack_unhealthy"
      && (snapshot.details.packChecks ?? []).some((check) => check.id === "telegram_token_validation" && check.ok)
  },
  platformActions: {
    getDynamicToolDeclarations: () => createDynamicToolDeclarations(TELEGRAM_DYNAMIC_TOOLS),
    interpretServerRequest: interpretTelegramServerRequest
  },
  healthChecks: {
    run: async ({ config, store, logger }) => {
      const telegramConfig = getTelegramPackConfig(config);
      const missingCredentials = TELEGRAM_PACK.authBinding.describeMissingCredentials(config);
      if (missingCredentials.length > 0) {
        return buildPackHealthReport({
          config,
          store,
          tokenValid: false
        });
      }

      const validation = await validateTelegramToken(telegramConfig.botToken, telegramConfig.apiBaseUrl);
      if (!validation.ok) {
        await logger.warn("telegram pack health check failed", {
          issue: validation.issue ?? "telegram token validation failed"
        });
      }

      return buildPackHealthReport({
        config,
        store,
        tokenValid: validation.ok,
        ...(validation.issue ? { tokenIssue: validation.issue } : {}),
        ...(validation.username ? { username: validation.username } : {}),
        ...(validation.botId ? { botId: validation.botId } : {})
      });
    }
  },
  getPackConfig: (config) => getTelegramPackConfig(config),
  createRuntime: ({ paths, config }) => new BridgeService(paths, config, {
    dynamicToolDeclarations: createDynamicToolDeclarations(TELEGRAM_DYNAMIC_TOOLS),
    interpretPackServerRequest: interpretTelegramServerRequest
  })
};
