import type { IncomingHttpHeaders } from "node:http";

export interface ReadonlyAccessGateOptions {
  enabled?: boolean;
  token?: string | null;
}

export interface ReadonlyLocalServerOptions {
  host: string;
  port: number;
  enabled: boolean;
  token?: string;
}

export interface ReadonlyAccessGate {
  readonly enabled: boolean;
  authorize(headers: IncomingHttpHeaders): boolean;
}

const DEFAULT_LOCAL_HOST = "127.0.0.1";

export function createReadonlyLocalServerOptions(
  options: Partial<ReadonlyLocalServerOptions> = {}
): ReadonlyLocalServerOptions {
  const result: ReadonlyLocalServerOptions = {
    host: options.host ?? DEFAULT_LOCAL_HOST,
    port: options.port ?? 0,
    enabled: options.enabled ?? false
  };
  if (options.token !== undefined) {
    result.token = options.token;
  }
  return result;
}

export function createReadonlyAccessGate(options: ReadonlyAccessGateOptions = {}): ReadonlyAccessGate {
  const token = normalizeToken(options.token);
  const enabled = options.enabled === true && Boolean(token);

  return {
    enabled,
    authorize(headers) {
      if (!enabled || !token) {
        return false;
      }
      return readBearerToken(headers.authorization) === token;
    }
  };
}

function normalizeToken(token: string | null | undefined): string | null {
  const trimmed = String(token ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || null;
}
