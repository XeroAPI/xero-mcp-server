import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export class XeroMcpServer {
  private static instance: McpServer | null = null;

  private constructor() {}

  public static GetServer(): McpServer {
    if (XeroMcpServer.instance === null) {
      XeroMcpServer.instance = new McpServer({
        name: "Xero MCP Server",
        version: "1.0.0",
        capabilities: {
          tools: {},
        },
      });
    }
    return XeroMcpServer.instance;
  }
}
