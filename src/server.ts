#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import dotenv from "dotenv";
import { URL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ToolFactory } from "./tools/tool-factory.js";

dotenv.config();

const DEFAULT_PORT = 3000;
const HEALTH_PATH = "/healthz";
const MCP_PATH = "/mcp";

type Session = {
  transport: SSEServerTransport;
  server: McpServer;
};

const sessions = new Map<string, Session>();

const mcpApiKey = process.env.MCP_API_KEY;
const isAuthEnabled = typeof mcpApiKey === "string" && mcpApiKey.length > 0;

const getAuthorizationHeader = (req: IncomingMessage): string | undefined => {
  const header = req.headers.authorization;
  if (!header) {
    return undefined;
  }

  return Array.isArray(header) ? header[0] : header;
};

const hasValidBearerToken = (authorizationHeader: string): boolean => {
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
  if (!match) {
    return false;
  }

  const token = match[1]?.trim();
  return Boolean(token) && token === mcpApiKey;
};

const isAuthorizedRequest = (req: IncomingMessage): boolean => {
  if (!isAuthEnabled) {
    return true;
  }

  const authorizationHeader = getAuthorizationHeader(req);
  if (!authorizationHeader) {
    return false;
  }

  return hasValidBearerToken(authorizationHeader);
};

const rejectUnauthorized = (res: ServerResponse): void => {
  if (!res.headersSent) {
    res.writeHead(401, {
      "Content-Type": "text/plain",
      "WWW-Authenticate": 'Bearer realm="xero-mcp-server"',
    });
  }
  res.end("Missing or invalid MCP API key");
};

const resolvePort = (): number => {
  const configured = Number.parseInt(process.env.PORT ?? "", 10);
  return Number.isNaN(configured) ? DEFAULT_PORT : configured;
};

const host = process.env.HOST ?? "0.0.0.0";
const port = resolvePort();

const buildServerWithTools = (): McpServer => {
  const server = XeroMcpServer.CreateServerInstance();
  ToolFactory(server);
  return server;
};

const handleHealthz = (_req: IncomingMessage, res: ServerResponse): void => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
};

const handleSseConnection = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  if (req.method !== "GET") {
    res.writeHead(405, { Allow: "GET, POST" });
    res.end("Method Not Allowed");
    return;
  }

  const server = buildServerWithTools();
  const transport = new SSEServerTransport(MCP_PATH, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { transport, server });

  transport.onclose = async () => {
    sessions.delete(sessionId);
    try {
      await server.close();
    } catch (error) {
      console.error("Error closing MCP server:", error);
    }
  };

  transport.onerror = (error) => {
    console.error("SSE transport error:", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Failed to initialize MCP session");
    }
    console.error("Failed to establish MCP SSE session:", error);
  }
};

const handleMcpPost = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> => {
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "GET, POST" });
    res.end("Method Not Allowed");
    return;
  }

  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing sessionId");
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Session not found");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Failed to handle MCP message");
    }
    console.error("Failed to handle MCP POST:", error);
  }
};

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid request");
      return;
    }

    const requestUrl = new URL(
      req.url,
      `http://${req.headers.host ?? `${host}:${port}`}`,
    );

    if (requestUrl.pathname === HEALTH_PATH && req.method === "GET") {
      handleHealthz(req, res);
      return;
    }

    if (requestUrl.pathname === MCP_PATH) {
      if (!isAuthorizedRequest(req)) {
        rejectUnauthorized(res);
        return;
      }

      if (req.method === "GET") {
        await handleSseConnection(req, res);
        return;
      }

      await handleMcpPost(req, res, requestUrl);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
    console.error("Unhandled server error:", error);
  }
});

server.listen(port, host, () => {
  console.log(`HTTP MCP server listening on http://${host}:${port}`);
});
