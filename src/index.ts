#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ToolFactory } from "./tools/tool-factory.js";

const main = async () => {
  // Create an MCP server
  const server = XeroMcpServer.GetServer();

  ToolFactory(server);

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

// `auth` subcommand: run the one-time OAuth2 authorization-code bootstrap that
// mints the XERO_TOKEN_FILE the self-refreshing client then keeps alive. Kept
// out of the default path so the stdio transport stays untouched on normal runs.
const run =
  process.argv[2] === "auth"
    ? async () => {
        const { runAuthorizationCodeFlow } = await import(
          "./auth/bootstrap-auth.js"
        );
        await runAuthorizationCodeFlow();
      }
    : main;

run().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
