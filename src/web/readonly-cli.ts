import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { Logger } from "../logger.js";
import type { BridgePaths } from "../paths.js";
import { createWebReadonlyLiveProvider } from "../service/web-readonly-live-provider.js";
import type {
  WebReadonlyPendingInteractionInputRow,
  WebReadonlyReadinessSnapshot
} from "../service/web-readonly-view-model.js";
import { BridgeStateStore } from "../state/store.js";
import type { PendingInteractionRow, ReadinessSnapshot } from "../types.js";
import { createReadonlyAccessGate, type ReadonlyAccessGate } from "./readonly-access.js";
import { createReadonlyHttpServer } from "./readonly-http-server.js";

const DEFAULT_WEB_READONLY_HOST = "127.0.0.1";
const DEFAULT_WEB_READONLY_PORT = 0;
const TOKEN_ENV_NAME = "CTB_WEB_READONLY_TOKEN";

export interface WebReadonlyLocalHarnessConfigInput {
  token?: string | boolean | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  host?: string | boolean | undefined;
  port?: string | number | boolean | undefined;
}

export interface WebReadonlyLocalHarnessConfig {
  host: string;
  port: number;
  token: string;
  access: ReadonlyAccessGate;
}

export interface WebReadonlyLocalHarnessStartOptions extends WebReadonlyLocalHarnessConfigInput {
  paths: BridgePaths;
  logger: Logger;
  write?: (line: string) => void;
}

export interface WebReadonlyLocalHarnessHandle {
  url: string;
  server: Server;
  close: () => Promise<void>;
}

export function buildWebReadonlyLocalHarnessConfig(
  input: WebReadonlyLocalHarnessConfigInput = {}
): WebReadonlyLocalHarnessConfig {
  const host = normalizeHost(input.host);
  const token = normalizeToken(typeof input.token === "string" ? input.token : input.env?.[TOKEN_ENV_NAME]);
  if (!token) {
    throw new Error(`${TOKEN_ENV_NAME} or --token is required for the local read-only prototype harness`);
  }

  return {
    host,
    port: normalizePort(input.port),
    token,
    access: createReadonlyAccessGate({ enabled: true, token })
  };
}

export async function startWebReadonlyLocalHarness(
  options: WebReadonlyLocalHarnessStartOptions
): Promise<WebReadonlyLocalHarnessHandle> {
  const config = buildWebReadonlyLocalHarnessConfig(options);
  await mkdir(dirname(options.paths.dbPath), { recursive: true });
  const store = await BridgeStateStore.open(options.paths, options.logger);
  const provider = createWebReadonlyLiveProvider({
    auth: {
      listOperatorBindings: () => store.listChatBindings().map((binding) => ({ chatId: binding.chatId }))
    },
    store: {
      listRecentProjects: () => store.listRecentProjects(),
      listSessionProjectStats: () => store.listSessionProjectStats(),
      listSessions: (chatId, listOptions) => store.listSessions(chatId, listOptions),
      getSessionById: (sessionId) => store.getSessionById(sessionId),
      listFinalAnswerViews: (chatId) => store.listFinalAnswerViews(chatId),
      getReadinessSnapshot: () => toReadonlyReadinessSnapshot(store.getReadinessSnapshot()),
      listPendingInteractions: (chatId) => toReadonlyPendingInteractions(store.listPendingInteractionsByChat(chatId))
    }
  });
  const server = createReadonlyHttpServer({ provider, access: config.access });

  try {
    await listen(server, config.port, config.host);
  } catch (error) {
    store.close();
    throw error;
  }

  const address = server.address() as AddressInfo;
  const url = `http://${config.host}:${address.port}/`;
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  write(`ctb web readonly local read-only prototype listening at ${url}`);
  write("Bearer token required. Local-only prototype; do not expose or treat as supported Web service.");

  return {
    url,
    server,
    close: async () => {
      await closeServer(server);
      store.close();
    }
  };
}

function normalizeHost(host: string | boolean | undefined): string {
  if (host === undefined || host === false) {
    return DEFAULT_WEB_READONLY_HOST;
  }
  if (host === DEFAULT_WEB_READONLY_HOST || host === "localhost") {
    return host;
  }
  throw new Error("ctb web readonly is local-only; external host binding is not supported");
}

function normalizePort(port: string | number | boolean | undefined): number {
  if (port === undefined || port === false) {
    return DEFAULT_WEB_READONLY_PORT;
  }
  const value = typeof port === "number" ? port : typeof port === "string" ? Number.parseInt(port, 10) : NaN;
  if (!Number.isInteger(value) || value < 0 || value > 65535 || String(port).trim() !== String(value)) {
    throw new Error("invalid --port value; expected an integer from 0 to 65535");
  }
  return value;
}

function normalizeToken(token: string | undefined): string | null {
  const trimmed = token?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function toReadonlyReadinessSnapshot(snapshot: ReadinessSnapshot | null): WebReadonlyReadinessSnapshot | null {
  return snapshot ? { ...snapshot, details: { ...snapshot.details } } : null;
}

function toReadonlyPendingInteractions(rows: PendingInteractionRow[]): WebReadonlyPendingInteractionInputRow[] {
  return rows.map((row) => ({ ...row }));
}

async function listen(server: Server, port: number, host: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
