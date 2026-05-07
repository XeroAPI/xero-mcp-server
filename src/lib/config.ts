import { getPackageVersion } from "../helpers/get-package-version.js";
import { ConfigurationError } from "./errors.js";
import type { LogLevelName } from "./logger.js";

export type TransportMode = "stdio" | "http";
export type HttpAuthMode = "bearer" | "oauth" | "none";
export type StagedUploadUrlStyle = "path" | "mcp-query";

export interface AppConfig {
  transportMode: TransportMode;
  logLevel: LogLevelName;
  server: {
    name: string;
    version: string;
  };
  http: {
    host: string;
    port: number;
    path: string;
    allowedHosts: string[];
    authMode: HttpAuthMode;
    bearerTokens: string[];
    allowUnauthenticated: boolean;
  };
  uploads: {
    publicBaseUrl?: string;
    mcpPath: string;
    path: string;
    urlStyle: StagedUploadUrlStyle;
    tempDir: string;
    maxBytes: number;
    ttlSeconds: number;
    signingSecret?: string;
  };
  oauth: {
    publicBaseUrl?: string;
    issuerUrl?: string;
    signingSecret?: string;
    supportedScopes: string[];
    authCodeTtlSeconds: number;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    googleClientId?: string;
    googleClientSecret?: string;
    googleHostedDomain?: string;
    googleAllowedEmailDomain?: string;
  };
}

const DEFAULT_SERVER_NAME = "Xero MCP Server";
const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_HTTP_HOST = "127.0.0.1";
const DEFAULT_HTTP_PATH = "/mcp";
const DEFAULT_UPLOAD_TEMP_DIR = "/tmp/cowork-xero-uploads";
const DEFAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_UPLOAD_TTL_SECONDS = 15 * 60;

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  key: string,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigurationError(`${key} must be a positive integer.`);
  }

  return parsed;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseCommaSeparatedList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseAbsoluteUrl(
  value: string | undefined,
  key: string,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConfigurationError(`${key} must be a valid absolute URL.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ConfigurationError(`${key} must use http or https.`);
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function ensureHttpPath(
  path: string | undefined,
  fallback = DEFAULT_HTTP_PATH,
): string {
  if (!path) {
    return fallback;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function resolveHttpAuthMode(
  env: NodeJS.ProcessEnv,
  bearerTokens: string[],
  allowUnauthenticated: boolean,
): HttpAuthMode {
  const explicitMode = env.MCP_HTTP_AUTH_MODE?.trim().toLowerCase();
  if (explicitMode) {
    if (
      explicitMode === "bearer" ||
      explicitMode === "oauth" ||
      explicitMode === "none"
    ) {
      return explicitMode;
    }

    throw new ConfigurationError(
      "MCP_HTTP_AUTH_MODE must be one of: bearer, oauth, none.",
    );
  }

  if (allowUnauthenticated) {
    return "none";
  }

  return "bearer";
}

function parseStagedUploadUrlStyle(
  value: string | undefined,
): StagedUploadUrlStyle {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "mcp-query";
  }

  if (normalized === "path" || normalized === "mcp-query") {
    return normalized;
  }

  throw new ConfigurationError(
    "MCP_STAGED_UPLOAD_URL_STYLE must be one of: path, mcp-query.",
  );
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const transportValue = env.MCP_TRANSPORT?.trim().toLowerCase();
  const transportMode: TransportMode =
    transportValue === "http" ? "http" : "stdio";

  const bearerTokens = parseCommaSeparatedList(env.MCP_HTTP_AUTH_BEARER_TOKENS);
  const allowUnauthenticated = parseBoolean(env.MCP_HTTP_ALLOW_UNAUTHENTICATED);
  const httpAuthMode = resolveHttpAuthMode(
    env,
    bearerTokens,
    allowUnauthenticated,
  );
  const publicBaseUrl = parseAbsoluteUrl(
    env.MCP_PUBLIC_BASE_URL,
    "MCP_PUBLIC_BASE_URL",
  );
  const issuerUrl =
    parseAbsoluteUrl(env.MCP_OAUTH_ISSUER_URL, "MCP_OAUTH_ISSUER_URL") ??
    publicBaseUrl;
  const supportedScopes = parseCommaSeparatedList(env.MCP_OAUTH_SCOPES);
  const httpPath = ensureHttpPath(env.MCP_HTTP_PATH);
  const uploadPathFallback = `${httpPath.replace(/\/+$/, "")}/uploads`;

  return {
    transportMode,
    logLevel: (env.LOG_LEVEL?.trim().toLowerCase() as LogLevelName) || "info",
    server: {
      name: env.MCP_SERVER_NAME?.trim() || DEFAULT_SERVER_NAME,
      version: env.MCP_SERVER_VERSION?.trim() || getPackageVersion(),
    },
    http: {
      host: env.MCP_HTTP_HOST?.trim() || DEFAULT_HTTP_HOST,
      port: parsePositiveInteger(
        env.MCP_HTTP_PORT,
        DEFAULT_HTTP_PORT,
        "MCP_HTTP_PORT",
      ),
      path: httpPath,
      allowedHosts: parseCommaSeparatedList(env.MCP_HTTP_ALLOWED_HOSTS),
      authMode: httpAuthMode,
      bearerTokens,
      allowUnauthenticated,
    },
    uploads: {
      publicBaseUrl,
      mcpPath: httpPath,
      path: ensureHttpPath(env.MCP_UPLOAD_PATH, uploadPathFallback),
      urlStyle: parseStagedUploadUrlStyle(env.MCP_STAGED_UPLOAD_URL_STYLE),
      tempDir:
        env.MCP_STAGED_UPLOAD_TEMP_DIR?.trim() || DEFAULT_UPLOAD_TEMP_DIR,
      maxBytes: parsePositiveInteger(
        env.MCP_STAGED_UPLOAD_MAX_BYTES,
        DEFAULT_UPLOAD_MAX_BYTES,
        "MCP_STAGED_UPLOAD_MAX_BYTES",
      ),
      ttlSeconds: parsePositiveInteger(
        env.MCP_STAGED_UPLOAD_TTL_SECONDS,
        DEFAULT_UPLOAD_TTL_SECONDS,
        "MCP_STAGED_UPLOAD_TTL_SECONDS",
      ),
      signingSecret:
        env.MCP_STAGED_UPLOAD_SIGNING_SECRET?.trim() ||
        env.MCP_OAUTH_SIGNING_SECRET?.trim() ||
        undefined,
    },
    oauth: {
      publicBaseUrl,
      issuerUrl,
      signingSecret: env.MCP_OAUTH_SIGNING_SECRET?.trim() || undefined,
      supportedScopes:
        supportedScopes.length > 0 ? supportedScopes : ["xero.mcp"],
      authCodeTtlSeconds: parsePositiveInteger(
        env.MCP_OAUTH_AUTH_CODE_TTL_SECONDS,
        300,
        "MCP_OAUTH_AUTH_CODE_TTL_SECONDS",
      ),
      accessTokenTtlSeconds: parsePositiveInteger(
        env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
        3600,
        "MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS",
      ),
      refreshTokenTtlSeconds: parsePositiveInteger(
        env.MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS,
        60 * 60 * 24 * 30,
        "MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS",
      ),
      googleClientId: env.GOOGLE_OAUTH_CLIENT_ID?.trim() || undefined,
      googleClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || undefined,
      googleHostedDomain: env.GOOGLE_OAUTH_HOSTED_DOMAIN?.trim() || undefined,
      googleAllowedEmailDomain:
        env.GOOGLE_OAUTH_ALLOWED_EMAIL_DOMAIN?.trim() ||
        env.GOOGLE_OAUTH_HOSTED_DOMAIN?.trim() ||
        undefined,
    },
  };
}
