import { createServer, IncomingMessage, ServerResponse } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { BearerTokenXeroClient, requestXeroClient } from "./clients/xero-client.js";
import { ToolFactory } from "./tools/tool-factory.js";

const MCP_PATH = "/mcp";
const MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Streamable HTTP mode. Each request carries its own Xero access token in `Authorization: Bearer <token>`
 * (for example from an MCP gateway that runs the Xero OAuth flow), so no Xero credentials live on this server.
 * An optional `Xero-Tenant-Id` header picks the organisation; otherwise the token's first connection is used.
 * Only `tools/call` requires the token; discovery requests are answered without one.
 * Stateless: a fresh MCP server and transport per request.
 */
export async function startHttpServer(host: string, port: number): Promise<void> {
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error("Request failed:", error);
      if (!res.headersSent) sendJson(res, 500, jsonRpcError("Internal server error"));
    });
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  console.error(`Xero MCP server listening on http://${host}:${port}${MCP_PATH}`);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = (req.url ?? "/").split("?")[0];

  if (path === "/health" && req.method === "GET") {
    sendJson(res, 200, { status: "ok" });
    return;
  }
  if (path !== MCP_PATH) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (req.method !== "POST") {
    // Stateless server: no SSE stream to resume and no session to delete
    res.writeHead(405, { Allow: "POST" }).end();
    return;
  }

  const body = await readJson(req);
  const token = bearerToken(req);
  // Discovery (initialize, tools/list, ping...) never calls Xero, so it is served without a token: gateways
  // health-check and list tools without a user's token. Tool calls need one.
  if (!token && callsTools(body)) {
    res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
    res.end(JSON.stringify(jsonRpcError("Missing Authorization: Bearer <Xero access token>")));
    return;
  }

  const tenantHeader = req.headers["xero-tenant-id"];
  const client = new BearerTokenXeroClient({
    // No token only reaches here for discovery, which does not touch the client
    bearerToken: token ?? "",
    tenantId: typeof tenantHeader === "string" && tenantHeader ? tenantHeader : undefined,
    perRequest: true,
  });

  const mcp = new McpServer({ name: "Xero MCP Server", version: "1.0.0" });
  ToolFactory(mcp);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void mcp.close();
  });

  await mcp.connect(transport);
  await requestXeroClient.run(client, () => transport.handleRequest(req, res, body));
}

function callsTools(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some((m) => (m as { method?: unknown } | null)?.method === "tools/call");
}

function bearerToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1].trim() || undefined;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

function jsonRpcError(message: string) {
  return { jsonrpc: "2.0", error: { code: -32000, message }, id: null };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}
