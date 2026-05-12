/**
 * JWT-gated MCP request handler.
 *
 * Each new SSE connection:
 *   1. Validates the bearer JWT (handled by mcp SDK's requireBearerAuth)
 *   2. Spawns the existing xero-mcp-server (dist/index.js) as a stdio child
 *      with the caller's per-user XERO_REFRESH_TOKEN_SECRET_NAME env var
 *   3. Bridges messages between the SSE transport (to Claude) and the
 *      stdio transport (to the child)
 *
 * Sessions are cached by their SSEServerTransport-generated sessionId and
 * evicted after 10 minutes of inactivity.
 */
import { Request, RequestHandler, Response, Router } from "express";

import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { XeroChainedOAuthProvider } from "./oauth-server.js";

const SESSION_IDLE_MS = 10 * 60_000;

type Session = {
  sse: SSEServerTransport;
  stdio: StdioClientTransport;
  sub: string;
  lastActivityAt: number;
};

export type McpHandlerConfig = {
  provider: XeroChainedOAuthProvider;
  projectId: string;
  xeroAppClientId: string;
  xeroAppClientSecret: string;
  serverEntrypoint: string;
};

export function buildMcpRouter(config: McpHandlerConfig): Router {
  const router = Router();
  const sessions = new Map<string, Session>();
  const sessionMessageEndpoint = "/message";

  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivityAt > SESSION_IDLE_MS) {
        closeSession(sessions, id);
      }
    }
  }, 60_000).unref();

  const bearerAuth = requireBearerAuth({ verifier: config.provider });

  router.get("/sse", bearerAuth, async (req: Request, res: Response) => {
    const sub = readSubFromAuth(req);
    if (!sub) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    let session: Session;
    try {
      session = await openSession({
        sub,
        config,
        res,
        sessionMessageEndpoint,
      });
    } catch (e) {
      const msg = (e as Error).message ?? "failed to start session";
      if (!res.headersSent) {
        res.status(500).json({
          error: "server_error",
          error_description: msg,
        });
      }
      return;
    }

    sessions.set(session.sse.sessionId, session);

    res.on("close", () => {
      closeSession(sessions, session.sse.sessionId);
    });
  });

  router.post(
    sessionMessageEndpoint,
    bearerAuth,
    async (req: Request, res: Response) => {
      const sub = readSubFromAuth(req);
      if (!sub) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }
      const sessionId =
        typeof req.query.sessionId === "string" ? req.query.sessionId : "";
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: "unknown_session" });
        return;
      }
      if (session.sub !== sub) {
        res.status(403).json({ error: "session_user_mismatch" });
        return;
      }
      session.lastActivityAt = Date.now();
      try {
        await session.sse.handlePostMessage(req, res, req.body);
      } catch (e) {
        const msg = (e as Error).message ?? "post failed";
        if (!res.headersSent) {
          res.status(400).json({
            error: "invalid_request",
            error_description: msg,
          });
        }
      }
    },
  );

  return router;
}

function readSubFromAuth(req: Request): string | undefined {
  const sub = req.auth?.extra?.["sub"];
  return typeof sub === "string" ? sub : undefined;
}

async function openSession(args: {
  sub: string;
  config: McpHandlerConfig;
  res: Response;
  sessionMessageEndpoint: string;
}): Promise<Session> {
  const { sub, config, res, sessionMessageEndpoint } = args;

  const sse = new SSEServerTransport(sessionMessageEndpoint, res);
  const stdio = new StdioClientTransport({
    command: process.execPath,
    args: [config.serverEntrypoint],
    env: {
      ...inheritedEnv(),
      XERO_APP_CLIENT_ID: config.xeroAppClientId,
      XERO_APP_CLIENT_SECRET: config.xeroAppClientSecret,
      XERO_REFRESH_TOKEN_SECRET_NAME: `projects/${config.projectId}/secrets/xero-refresh-token-${sub}`,
    },
    stderr: "inherit",
  });

  // Bridge SSE → stdio (Claude → MCP server)
  sse.onmessage = (msg: JSONRPCMessage) => {
    void stdio.send(msg).catch((err) => {
       
      console.error("[mcp-handler] stdio send failed", err);
    });
  };
  // Bridge stdio → SSE (MCP server → Claude)
  stdio.onmessage = (msg: JSONRPCMessage) => {
    void sse.send(msg).catch((err) => {
       
      console.error("[mcp-handler] sse send failed", err);
    });
  };

  const closeBoth = () => {
    void sse.close().catch(() => undefined);
    void stdio.close().catch(() => undefined);
  };
  sse.onclose = closeBoth;
  stdio.onclose = closeBoth;
  sse.onerror = (err) =>
     
    console.error("[mcp-handler] sse error", err);
  stdio.onerror = (err) =>
     
    console.error("[mcp-handler] stdio error", err);

  await stdio.start();
  await sse.start();

  return {
    sse,
    stdio,
    sub,
    lastActivityAt: Date.now(),
  };
}

function closeSession(sessions: Map<string, Session>, id: string): void {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  void s.sse.close().catch(() => undefined);
  void s.stdio.close().catch(() => undefined);
}

function inheritedEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export type { Session };
export type { RequestHandler };
