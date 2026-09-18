import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { ToolFactory } from "../../../dist/tools/tool-factory.js";
import {
  createBearerTokenXeroClient,
  withXeroClient,
} from "../../../dist/clients/xero-client.js";
import { XERO_OAUTH_SCOPES } from "../../../src/xero-oauth-scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

const mcpHandler = createMcpHandler(
  (server) => {
    ToolFactory(server);
  },
  {
    serverInfo: {
      name: "Xero MCP Server",
      version: "0.0.16-chatgpt",
    },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration,
    verboseLogs: true,
  },
);

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

async function verifyToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const response = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return undefined;

  const connections = (await response.json()) as Array<{
    tenantId?: string;
  }>;
  const tenantId = connections[0]?.tenantId;

  if (!tenantId) return undefined;

  return {
    token: bearerToken,
    // Xero access tokens are opaque. A successful connections lookup confirms
    // the token is valid for this Xero app; report the same scopes advertised
    // on every MCP tool so ChatGPT can authorize those tool calls correctly.
    scopes: [...XERO_OAUTH_SCOPES],
    clientId: "xero",
    extra: { tenantId },
  };
}

const authenticatedHandler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

function handleRequest(request: Request): Promise<Response> {
  const bearerToken = getBearerToken(request);

  return withXeroClient(
    bearerToken ? createBearerTokenXeroClient(bearerToken) : undefined,
    () => authenticatedHandler(request),
  );
}

export const GET = handleRequest;
export const POST = handleRequest;
