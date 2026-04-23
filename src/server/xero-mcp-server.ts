import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { ToolFactory } from "../tools/tool-factory.js";

export function createXeroMcpServer(): McpServer {
  const server = new McpServer({
    name: "Xero MCP Server",
    version: getPackageVersion(),
  });

  ToolFactory(server);

  return server;
}
