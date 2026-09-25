#!/usr/bin/env node

/**
 * Xero MCP Server — HTTP entrypoint for MCPfy Deploy
 */

import { MCPServer } from "mcpfy-sdk/server";
import { getPackageVersion } from "./helpers/get-package-version.js";
import { ToolFactory } from "./tools/tool-factory.js";

async function main(): Promise<void> {
  const server = new MCPServer({
    name: "Xero MCP Server",
    version: getPackageVersion(),
    description: "MCP server implementation for Xero integration",
  });

  ToolFactory(server.nativeServer);

  await server.listen({
    transport: "http",
    host: "0.0.0.0",
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Error:", message);
  process.exit(1);
});
