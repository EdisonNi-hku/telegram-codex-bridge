import {
  createDynamicToolDeclarations,
  interpretDynamicToolRequest,
  interpretSharedServerRequest
} from "../../codex/server-request-policy.js";
import { FeishuTelegramApiCompat } from "../../feishu/api.js";
import { FeishuTelegramPollerCompat } from "../../feishu/poller.js";
import { BridgeService } from "../../service.js";
import type { BridgePackDefinition, PackHealthReport } from "../contract.js";
import {
  FEISHU_PACK_DISPLAY_NAME,
  FEISHU_PACK_SKILL_NAME,
  getFeishuPackConfig,
  type FeishuPackConfig
} from "./config.js";
import { buildFeishuSetupHealth } from "./setup.js";

const FEISHU_DYNAMIC_TOOLS = [{
  toolName: "send_feishu_file",
  action: "send_control_surface_file",
  description: "Send a local server file to the active Feishu control surface as a file attachment.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      caption: { type: "string" },
      filename: { type: "string" }
    },
    required: ["path"]
  }
}] as const;

const FEISHU_SURFACE_CAPABILITY_SNAPSHOT = {
  supportsCallbacks: true,
  supportsEdits: true,
  supportsRichTextPreview: true,
  supportsLongFormPagination: true,
  supportsUploads: true
} as const;

async function validateFeishuTenantToken(config: FeishuPackConfig): Promise<{
  ok: boolean;
  issue?: string;
}> {
  try {
    const response = await fetch(`${config.apiBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret
      }),
      signal: AbortSignal.timeout(20_000)
    });
    const payload = await response.json() as {
      code?: number;
      msg?: string;
      tenant_access_token?: string;
    };
    if (!response.ok || payload.code !== 0 || typeof payload.tenant_access_token !== "string") {
      return {
        ok: false,
        issue: payload.msg ?? `http ${response.status}`
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      issue: `${error}`
    };
  }
}

function buildPackHealthReport(options: {
  appId: string;
  authorized: boolean;
  tokenValid: boolean;
  missingCredentials: string[];
  tokenIssue?: string;
}): PackHealthReport {
  const credentialsCheck = {
    id: "feishu_credentials",
    ok: options.missingCredentials.length === 0,
    summary: options.missingCredentials.length === 0 ? "feishu credentials configured" : "feishu credentials missing",
    blocking: true,
    source: "automatic" as const,
    ...(options.missingCredentials.length > 0 ? { missingEnv: options.missingCredentials } : {})
  };
  const tokenCheck = {
    id: "feishu_tenant_token_validation",
    ok: options.missingCredentials.length === 0 && options.tokenValid,
    summary: options.missingCredentials.length > 0
      ? "feishu tenant access token not checked because credentials are missing"
      : options.tokenValid
        ? "feishu tenant access token validated"
        : options.tokenIssue ?? "feishu tenant access token validation failed"
    ,
    blocking: true,
    source: "automatic" as const
  };
  const bindingCheck = {
    id: "feishu_authorization_binding",
    ok: options.authorized,
    summary: options.authorized ? "feishu authorization is bound" : "feishu authorization is pending",
    blocking: true,
    source: "automatic" as const
  };
  const checks = [credentialsCheck, tokenCheck, bindingCheck];

  return {
    state: !credentialsCheck.ok || !tokenCheck.ok
      ? "pack_unhealthy"
      : bindingCheck.ok
        ? "ready"
        : "awaiting_authorization",
    checks,
    issues: checks.filter((check) => !check.ok).map((check) => check.summary),
    metadata: {
      feishuAppId: options.appId || null
    },
    setupState: "incomplete"
  };
}

function interpretFeishuServerRequest(request: Parameters<typeof interpretSharedServerRequest>[0]) {
  const shared = interpretSharedServerRequest(request);
  if (shared) {
    return shared;
  }

  return interpretDynamicToolRequest(request, FEISHU_DYNAMIC_TOOLS);
}

export const FEISHU_PACK: BridgePackDefinition<FeishuPackConfig> = {
  name: "feishu",
  displayName: FEISHU_PACK_DISPLAY_NAME,
  skillName: FEISHU_PACK_SKILL_NAME,
  capabilities: FEISHU_SURFACE_CAPABILITY_SNAPSHOT,
  ingress: {
    kind: "polling",
    ownsCallbacks: true,
    ownsRichInput: false,
    ownsMediaIngress: false
  },
  egress: {
    kind: "bot_api",
    syncControlSurface: async () => {}
  },
  authBinding: {
    isBound: (store) => store.getAuthorizedUser("feishu") !== null,
    describeMissingCredentials: (config) => {
      const feishuConfig = getFeishuPackConfig(config);
      const missing: string[] = [];
      if (!feishuConfig.appId.trim()) {
        missing.push("FEISHU_APP_ID");
      }
      if (!feishuConfig.appSecret.trim()) {
        missing.push("FEISHU_APP_SECRET");
      }
      return missing;
    }
  },
  install: {
    validateInstallConfig: (config) => {
      const feishuConfig = getFeishuPackConfig(config);
      if (!feishuConfig.appId.trim()) {
        throw new Error("missing Feishu app id; pass --pack-option app-id=<id> or set FEISHU_APP_ID");
      }
      if (!feishuConfig.appSecret.trim()) {
        throw new Error("missing Feishu app secret; pass --pack-option app-secret=<secret> or set FEISHU_APP_SECRET");
      }
    },
    shouldSyncControlSurface: () => false
  },
  platformActions: {
    getDynamicToolDeclarations: () => createDynamicToolDeclarations(FEISHU_DYNAMIC_TOOLS),
    interpretServerRequest: interpretFeishuServerRequest
  },
  healthChecks: {
    run: async ({ config, store, logger }) => {
      const feishuConfig = getFeishuPackConfig(config);
      const missingCredentials = FEISHU_PACK.authBinding.describeMissingCredentials(config);
      if (missingCredentials.length > 0) {
        return buildPackHealthReport({
          appId: feishuConfig.appId,
          authorized: FEISHU_PACK.authBinding.isBound(store),
          tokenValid: false,
          missingCredentials
        });
      }

      const validation = await validateFeishuTenantToken(feishuConfig);
      if (!validation.ok) {
        await logger.warn("feishu pack health check failed", {
          issue: validation.issue ?? "feishu tenant token validation failed"
        });
      }

      const report = buildPackHealthReport({
        appId: feishuConfig.appId,
        authorized: FEISHU_PACK.authBinding.isBound(store),
        tokenValid: validation.ok,
        missingCredentials,
        ...(validation.issue ? { tokenIssue: validation.issue } : {})
      });

      const setupHealth = buildFeishuSetupHealth({
        report,
        authorized: FEISHU_PACK.authBinding.isBound(store)
      });

      return {
        ...report,
        ...setupHealth
      };
    }
  },
  getPackConfig: (config) => getFeishuPackConfig(config),
  createRuntime: ({ paths, config }) => new BridgeService(paths, config, {
    createTelegramApi: () => new FeishuTelegramApiCompat(getFeishuPackConfig(config), paths) as never,
    createPoller: (api, runtimeConfig, runtimePaths, runtimeLogger, onUpdate) =>
      new FeishuTelegramPollerCompat(
        api as unknown as FeishuTelegramApiCompat,
        runtimeConfig,
        runtimePaths,
        runtimeLogger,
        onUpdate
      ) as never,
    dynamicToolDeclarations: createDynamicToolDeclarations(FEISHU_DYNAMIC_TOOLS),
    interpretPackServerRequest: interpretFeishuServerRequest
  })
};
