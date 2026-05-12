/**
 * Cloud Run entrypoint for the shared MCP service.
 *
 * Composes:
 *   - GET /healthz (open)
 *   - GET /callback (Xero redirect target)
 *   - MCP SDK auth router (/authorize, /token, /register, /revoke, /.well-known)
 *   - JWT-gated MCP transport routes (/sse, /message)
 *
 * Env vars (all required):
 *   PUBLIC_URL                       — outward-facing URL of this service (e.g. https://xero-mcp-xxx.run.app)
 *   GCP_PROJECT                      — project id, used for Secret Manager paths
 *   XERO_APP_CLIENT_ID               — mounted from Secret Manager xero-app-id
 *   XERO_APP_CLIENT_SECRET           — mounted from Secret Manager xero-app-secret
 *   MCP_JWT_SECRET                   — mounted from Secret Manager mcp-jwt-secret
 *   PORT                             — Cloud Run default 8080
 *   MCP_SERVER_ENTRYPOINT (optional) — path to dist/index.js, defaults to /app/dist/index.js
 */
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import express, { type Request, type Response } from "express";

import { buildMcpRouter } from "./mcp-handler.js";
import {
  XeroChainedOAuthProvider,
  buildMcpAuthRouter,
  createXeroCallbackRouter,
} from "./oauth-server.js";

const ALLOWED_ORIGINS = new Set([
  "https://claude.ai",
  "https://claude.com",
]);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function corsMiddleware(
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
): void {
  const origin = req.headers.origin;
  if (typeof origin === "string" && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, MCP-Protocol-Version");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

async function main(): Promise<void> {
  const publicUrl = requireEnv("PUBLIC_URL").replace(/\/$/, "");
  const projectId = requireEnv("GCP_PROJECT");
  const xeroClientId = requireEnv("XERO_APP_CLIENT_ID");
  const xeroClientSecret = requireEnv("XERO_APP_CLIENT_SECRET");
  const jwtSecret = requireEnv("MCP_JWT_SECRET");
  const port = Number(process.env.PORT ?? 8080);
  const serverEntrypoint =
    process.env.MCP_SERVER_ENTRYPOINT ?? "/app/dist/index.js";

  const secretManager = new SecretManagerServiceClient();

  const provider = new XeroChainedOAuthProvider({
    xeroClientId,
    xeroClientSecret,
    callbackUrl: `${publicUrl}/callback`,
    jwtSecret,
    projectId,
    secretManager,
  });

  const app = express();
  app.disable("x-powered-by");
  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(createXeroCallbackRouter(provider));
  app.use(buildMcpAuthRouter(provider, new URL(publicUrl)));
  app.use(
    buildMcpRouter({
      provider,
      projectId,
      xeroAppClientId: xeroClientId,
      xeroAppClientSecret: xeroClientSecret,
      serverEntrypoint,
    }),
  );

  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      next: (e?: unknown) => void,
    ) => {
      console.error("[entrypoint] unhandled error", err);
      if (res.headersSent) {
        next(err);
        return;
      }
      res.status(500).json({ error: "server_error" });
    },
  );

  const server = app.listen(port, "0.0.0.0", () => {
     
    console.log(`[entrypoint] listening on port ${port}, public URL ${publicUrl}`);
  });

  const shutdown = (signal: string) => {
     
    console.log(`[entrypoint] received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
   
  console.error("[entrypoint] fatal", err);
  process.exit(1);
});
