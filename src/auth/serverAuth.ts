import type { RequestHandler } from "express";

import type { AppConfig } from "../lib/config.js";
import { ConfigurationError } from "../lib/errors.js";
import type { Logger } from "../lib/logger.js";

export function assertHttpAuthConfigured(config: AppConfig): void {
  switch (config.http.authMode) {
    case "none":
      return;
    case "bearer":
      if (config.http.bearerTokens.length === 0) {
        throw new ConfigurationError(
          "HTTP bearer auth requires MCP_HTTP_AUTH_BEARER_TOKENS unless MCP_HTTP_AUTH_MODE=none is explicitly set.",
        );
      }
      return;
    case "oauth":
      if (!config.oauth.publicBaseUrl) {
        throw new ConfigurationError(
          "HTTP OAuth mode requires MCP_PUBLIC_BASE_URL.",
        );
      }

      if (!config.oauth.issuerUrl) {
        throw new ConfigurationError(
          "HTTP OAuth mode requires an issuer URL derived from MCP_PUBLIC_BASE_URL or MCP_OAUTH_ISSUER_URL.",
        );
      }

      if (!config.oauth.signingSecret) {
        throw new ConfigurationError(
          "HTTP OAuth mode requires MCP_OAUTH_SIGNING_SECRET.",
        );
      }

      if (!config.oauth.googleClientId || !config.oauth.googleClientSecret) {
        throw new ConfigurationError(
          "HTTP OAuth mode requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
        );
      }

      if (!config.oauth.googleAllowedEmailDomain) {
        throw new ConfigurationError(
          "HTTP OAuth mode requires GOOGLE_OAUTH_ALLOWED_EMAIL_DOMAIN or GOOGLE_OAUTH_HOSTED_DOMAIN.",
        );
      }
      return;
    default:
      throw new ConfigurationError(
        `Unsupported HTTP auth mode "${String(config.http.authMode)}".`,
      );
  }
}

export function createStaticBearerAuthMiddleware(
  tokens: string[],
  logger: Logger,
): RequestHandler {
  const allowedTokens = new Set(tokens);

  return (request, response, next) => {
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      logger.warn("http_request_unauthorized", {
        reason: "missing_bearer_token",
        path: request.path,
      });
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!allowedTokens.has(token)) {
      logger.warn("http_request_unauthorized", {
        reason: "invalid_bearer_token",
        path: request.path,
      });
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}
