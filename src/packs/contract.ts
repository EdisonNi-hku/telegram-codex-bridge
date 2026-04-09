import type { BridgeConfig } from "../config.js";
import type { JsonRpcServerRequest } from "../codex/app-server.js";
import type { BridgeDynamicToolDeclaration, ServerRequestSupport } from "../codex/server-request-policy.js";
import type { PlatformCapabilitySnapshot } from "../core/interaction-model/surface.js";
import type { Logger } from "../logger.js";
import type { BridgePaths } from "../paths.js";
import type { BridgeStateStore } from "../state/store.js";
import type { ReadinessSnapshot } from "../types.js";
import type { BridgePackName } from "./names.js";

export interface PackHealthCheck {
  id: string;
  ok: boolean;
  summary: string;
  missingEnv?: string[] | undefined;
  blocking?: boolean | undefined;
  source?: "automatic" | "observed" | "operator_checklist" | "heuristic" | undefined;
}

export interface PackHealthReport {
  state: "ready" | "awaiting_authorization" | "pack_unhealthy";
  checks: PackHealthCheck[];
  issues: string[];
  metadata?: Record<string, string | boolean | null | undefined>;
  setupState?: "complete" | "incomplete";
  setupChecklist?: string[];
}

export interface BridgePackRuntime {
  run(): Promise<void>;
  stop(context?: { source?: string; signal?: string | null }): Promise<void>;
}

export interface BridgePackDefinition<PackConfig = unknown> {
  name: BridgePackName;
  displayName: string;
  skillName: string;
  capabilities: PlatformCapabilitySnapshot;
  ingress: {
    kind: "polling" | "long_connection";
    ownsCallbacks: boolean;
    ownsRichInput: boolean;
    ownsMediaIngress: boolean;
  };
  presentation: {
    preferBridgeCommandButtons: boolean;
  };
  egress: {
    kind: "bot_api" | "open_api";
    syncControlSurface(options: {
      config: BridgeConfig;
      logger: Logger;
    }): Promise<void>;
  };
  authBinding: {
    isBound(store: BridgeStateStore): boolean;
    describeMissingCredentials(config: BridgeConfig): string[];
  };
  install: {
    validateInstallConfig(config: BridgeConfig): void;
    shouldSyncControlSurface(snapshot: ReadinessSnapshot): boolean;
  };
  platformActions: {
    getDynamicToolDeclarations(): BridgeDynamicToolDeclaration[];
    interpretServerRequest(request: JsonRpcServerRequest): ServerRequestSupport;
  };
  healthChecks: {
    run(options: {
      config: BridgeConfig;
      store: BridgeStateStore;
      logger: Logger;
    }): Promise<PackHealthReport>;
  };
  getPackConfig(config: BridgeConfig): PackConfig;
  createRuntime(options: {
    paths: BridgePaths;
    config: BridgeConfig;
  }): BridgePackRuntime;
}
