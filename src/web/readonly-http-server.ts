import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { WebReadonlyViewModelProvider } from "../service/web-readonly-view-model.js";
import type { ReadonlyAccessGate } from "./readonly-access.js";
import {
  renderConversationArtifactCatalogPage,
  renderConversationResultPage,
  renderGenericErrorPage,
  renderGenericNotFoundPage,
  renderHomePage,
  renderPendingInteractionsPage,
  renderReadinessPage,
  renderRuntimePage,
  renderWorkspaceConversationListPage,
  renderWorkspaceListPage
} from "./readonly-renderer.js";

export interface ReadonlyHttpServerOptions {
  provider: WebReadonlyViewModelProvider;
  access: ReadonlyAccessGate;
}

type RouteResult = { status: number; html: string };

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "text/html; charset=utf-8"
} as const;

export function createReadonlyHttpServer(options: ReadonlyHttpServerOptions): Server {
  return createServer((request, response) => {
    void handleRequest(options, request, response);
  });
}

async function handleRequest(
  options: ReadonlyHttpServerOptions,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return send(response, 404, renderGenericNotFoundPage(), request.method === "HEAD");
    }

    if (!options.access.authorize(request.headers)) {
      return send(response, 404, renderGenericNotFoundPage(), request.method === "HEAD");
    }

    const route = resolveRoute(request.url ?? "/", options.provider);
    return send(response, route.status, route.html, request.method === "HEAD");
  } catch {
    return send(response, 500, renderGenericErrorPage(), request.method === "HEAD");
  }
}

function resolveRoute(urlValue: string, provider: WebReadonlyViewModelProvider): RouteResult {
  let pathname = "/";
  try {
    pathname = new URL(urlValue, "http://127.0.0.1").pathname;
  } catch {
    return { status: 404, html: renderGenericNotFoundPage() };
  }

  if (pathname === "/") {
    return { status: 200, html: renderHomePage(provider.getHomeViewModel()) };
  }
  if (pathname === "/readiness") {
    return { status: 200, html: renderReadinessPage(provider.getReadinessGuardrailViewModel()) };
  }
  if (pathname === "/runtime") {
    return { status: 200, html: renderRuntimePage(provider.getRuntimeContextViewModel()) };
  }
  if (pathname === "/workspaces") {
    return { status: 200, html: renderWorkspaceListPage(provider.listWorkspaceViewModels()) };
  }
  if (pathname === "/interactions") {
    return { status: 200, html: renderPendingInteractionsPage(provider.getPendingInteractionsViewModel()) };
  }

  const artifactsMatch = /^\/sessions\/([^/]+)\/artifacts$/.exec(pathname);
  if (artifactsMatch?.[1]) {
    return {
      status: 200,
      html: renderConversationArtifactCatalogPage(provider.getConversationArtifactCatalogViewModel(decodeRoutePart(artifactsMatch[1])))
    };
  }

  const sessionMatch = /^\/sessions\/([^/]+)$/.exec(pathname);
  if (sessionMatch?.[1]) {
    return {
      status: 200,
      html: renderConversationResultPage(provider.getConversationResultViewModel(decodeRoutePart(sessionMatch[1])))
    };
  }

  const workspaceMatch = /^\/workspaces\/([^/]+)\/conversations$/.exec(pathname);
  if (workspaceMatch?.[1]) {
    return {
      status: 200,
      html: renderWorkspaceConversationListPage(provider.listWorkspaceConversationViewModels(decodeRoutePart(workspaceMatch[1])))
    };
  }

  return { status: 404, html: renderGenericNotFoundPage() };
}

function decodeRoutePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function send(response: ServerResponse, status: number, html: string, headOnly: boolean): void {
  response.writeHead(status, SECURITY_HEADERS);
  response.end(headOnly ? undefined : html);
}
