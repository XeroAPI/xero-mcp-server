/**
 * JWT-gated MCP transport endpoint.
 *
 * Uses the Streamable HTTP transport (the current preferred transport per
 * the MCP spec, also what Claude Desktop's remote connector flow uses).
 *
 * Per session:
 *   1. Validate the bearer JWT (handled by mcp SDK's requireBearerAuth)
 *   2. On the initialize request, spawn the existing xero-mcp-server
 *      (dist/index.js) as a stdio child with the caller's per-user
 *      XERO_REFRESH_TOKEN_SECRET_NAME, attach a Streamable HTTP transport
 *      and bridge messages between the two
 *   3. Sessions cached by their mcp-session-id with a 10-min idle timeout
 */
import { randomUUID } from "node:crypto";
import { Request, RequestHandler, Response, Router } from "express";

import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { XeroChainedOAuthProvider } from "./oauth-server.js";

const SESSION_IDLE_MS = 10 * 60_000;
const MCP_SESSION_HEADER = "mcp-session-id";

type Session = {
  http: StreamableHTTPServerTransport;
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

  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivityAt > SESSION_IDLE_MS) {
        closeSession(sessions, id);
      }
    }
  }, 60_000).unref();

  const bearerAuth = requireBearerAuth({ verifier: config.provider });

  const handle = async (req: Request, res: Response): Promise<void> => {
    const sub = readSubFromAuth(req);
    if (!sub) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    const sessionIdHeader =
      typeof req.headers[MCP_SESSION_HEADER] === "string"
        ? (req.headers[MCP_SESSION_HEADER] as string)
        : undefined;

    let session: Session | undefined = sessionIdHeader
      ? sessions.get(sessionIdHeader)
      : undefined;

    if (session && session.sub !== sub) {
      res.status(403).json({ error: "session_user_mismatch" });
      return;
    }

    if (!session) {
      // Per the MCP Streamable HTTP spec: if a request carries a session id
      // we don't know (e.g. survived a container restart), return 404 so the
      // client drops the stale id and re-initializes without one.
      if (sessionIdHeader) {
        res.status(404).json({
          error: "session_not_found",
          error_description: "Re-initialize without an mcp-session-id header.",
        });
        return;
      }
      if (req.method !== "POST") {
        res.status(400).json({ error: "session_required" });
        return;
      }
      try {
        session = await openSession({ sub, config, sessions });
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
    }

    session.lastActivityAt = Date.now();
    try {
      await session.http.handleRequest(
        req,
        res,
        req.method === "POST" ? req.body : undefined,
      );
    } catch (e) {
      const err = e as Error;
      console.error(
        "[mcp-handler] handleRequest threw",
        err?.message,
        err?.stack,
      );
      if (!res.headersSent) {
        res.status(500).json({
          error: "server_error",
          error_description: err?.message ?? "handler error",
        });
      }
    }
  };

  router.post("/mcp", bearerAuth, handle);
  router.get("/mcp", bearerAuth, handle);
  router.delete("/mcp", bearerAuth, handle);

  return router;
}

function readSubFromAuth(req: Request): string | undefined {
  const sub = req.auth?.extra?.["sub"];
  return typeof sub === "string" ? sub : undefined;
}

async function openSession(args: {
  sub: string;
  config: McpHandlerConfig;
  sessions: Map<string, Session>;
}): Promise<Session> {
  const { sub, config, sessions } = args;

  const http = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

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

  // Bridge HTTP → stdio (Claude → MCP server)
  http.onmessage = (msg: JSONRPCMessage) => {
    void stdio.send(msg).catch((err) => {
      console.error("[mcp-handler] stdio send failed", err);
    });
  };
  // Bridge stdio → HTTP (MCP server → Claude)
  stdio.onmessage = (msg: JSONRPCMessage) => {
    void http.send(msg).catch((err) => {
      console.error("[mcp-handler] http send failed", err);
    });
  };

  const closeBoth = () => {
    void http.close().catch(() => undefined);
    void stdio.close().catch(() => undefined);
    if (http.sessionId) sessions.delete(http.sessionId);
  };
  http.onclose = closeBoth;
  stdio.onclose = closeBoth;
  http.onerror = (err) => console.error("[mcp-handler] http error", err);
  stdio.onerror = (err) => console.error("[mcp-handler] stdio error", err);

  await stdio.start();
  await http.start();

  const session: Session = {
    http,
    stdio,
    sub,
    lastActivityAt: Date.now(),
  };

  // The transport generates the session id during the first POST (initialize).
  // We watch for it and register the session as soon as it's known.
  const trackSessionId = () => {
    if (http.sessionId && !sessions.has(http.sessionId)) {
      sessions.set(http.sessionId, session);
    }
  };
  const wrappedSend = http.send.bind(http);
  http.send = async (msg, opts) => {
    trackSessionId();
    return wrappedSend(msg, opts);
  };

  return session;
}

function closeSession(sessions: Map<string, Session>, id: string): void {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  void s.http.close().catch(() => undefined);
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
