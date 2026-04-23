import type { Server as HttpServer } from "node:http";

import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";

import { GoogleBackedMcpOAuthProvider } from "../../auth/oauth/mcpOAuthProvider.js";
import {
  assertHttpAuthConfigured,
  createStaticBearerAuthMiddleware,
} from "../../auth/serverAuth.js";
import type { AppConfig } from "../../lib/config.js";
import type { Logger } from "../../lib/logger.js";
import { createXeroMcpServer } from "../xero-mcp-server.js";

function sendMethodNotAllowed(response: Response): void {
  response.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
}

function registerShutdown(server: HttpServer, logger: Logger): void {
  let closing = false;

  const shutdown = () => {
    if (closing) {
      return;
    }

    closing = true;
    logger.info("shutdown_requested", {
      transport: "http",
    });

    server.close((error) => {
      if (error) {
        logger.error("http_server_shutdown_failed", {
          error: error.message,
        });
        process.exitCode = 1;
      }

      process.exit();
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

export async function runHttpServer(
  config: AppConfig,
  logger: Logger,
): Promise<void> {
  assertHttpAuthConfigured(config);

  const app = createMcpExpressApp({
    host: config.http.host,
    allowedHosts:
      config.http.allowedHosts.length > 0 ? config.http.allowedHosts : undefined,
  });
  app.set("trust proxy", true);

  switch (config.http.authMode) {
    case "none":
      logger.warn("http_auth_disabled", {
        path: config.http.path,
      });
      break;
    case "bearer":
      app.use(
        config.http.path,
        createStaticBearerAuthMiddleware(
          config.http.bearerTokens,
          logger.child({ component: "http_auth" }),
        ),
      );
      break;
    case "oauth": {
      const oauthProvider = new GoogleBackedMcpOAuthProvider(
        config,
        logger.child({ component: "oauth" }),
      );
      const resourceServerUrl = new URL(
        config.http.path,
        `${config.oauth.publicBaseUrl}/`,
      );

      app.use(
        mcpAuthRouter({
          provider: oauthProvider,
          issuerUrl: new URL(oauthProvider.getIssuerUrl()),
          resourceServerUrl,
          baseUrl: new URL(`${config.oauth.publicBaseUrl}/`),
          scopesSupported: oauthProvider.getSupportedScopes(),
          resourceName: config.server.name,
          clientRegistrationOptions: {
            clientIdGeneration: false,
          },
        }),
      );
      app.get(
        "/oauth/google/callback",
        oauthProvider.createGoogleCallbackHandler(),
      );
      app.use(
        config.http.path,
        requireBearerAuth({
          verifier: oauthProvider,
          requiredScopes: [],
          resourceMetadataUrl:
            getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
        }),
      );
      break;
    }
  }

  const healthPayload = {
    ok: true,
    server: config.server.name,
    transport: "http",
    mcpPath: config.http.path,
    authMode: config.http.authMode,
  };

  app.get("/", (_request, response) => {
    response.status(200).json(healthPayload);
  });

  app.get("/health", (_request, response) => {
    response.status(200).json(healthPayload);
  });

  app.get("/healthz", (_request, response) => {
    response.status(200).json(healthPayload);
  });

  app.post(config.http.path, async (request: Request, response: Response) => {
    const server = createXeroMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
      response.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      logger.error("http_request_failed", {
        path: request.path,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  app.get(config.http.path, (_request, response) => {
    sendMethodNotAllowed(response);
  });

  app.delete(config.http.path, (_request, response) => {
    sendMethodNotAllowed(response);
  });

  const httpServer = await new Promise<HttpServer>((resolve, reject) => {
    const listener = app.listen(
      config.http.port,
      config.http.host,
      () => resolve(listener),
    );
    listener.on("error", reject);
  });

  registerShutdown(httpServer, logger);

  logger.info("server_started", {
    transport: "http",
    host: config.http.host,
    port: config.http.port,
    path: config.http.path,
    authenticated: config.http.authMode !== "none",
    authMode: config.http.authMode,
    publicBaseUrl: config.oauth.publicBaseUrl,
  });
}
