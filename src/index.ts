#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { assertEnvCredentials } from "./clients/xero-client.js";
import { startHttpServer } from "./http-server.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ToolFactory } from "./tools/tool-factory.js";

const main = async () => {
  // XERO_MCP_TRANSPORT=http: Streamable HTTP, Xero token per request (see http-server.ts). Default: stdio.
  if (process.env.XERO_MCP_TRANSPORT === "http") {
    const host = process.env.XERO_MCP_HTTP_HOST ?? "127.0.0.1";
    const port = Number(process.env.XERO_MCP_HTTP_PORT ?? "3000");
    await startHttpServer(host, port);
    return;
  }

  assertEnvCredentials();

  // Create an MCP server
  const server = XeroMcpServer.GetServer();

  ToolFactory(server);

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
