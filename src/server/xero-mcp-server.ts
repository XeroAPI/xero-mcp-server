import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export class XeroMcpServer {
  private static instance: McpServer | null = null;

  private constructor() {}

  private static createServer(): McpServer {
    return new McpServer({
      name: "Xero MCP Server",
      version: "1.0.0",
      capabilities: {
        tools: {},
      },
    });
  }

  public static GetServer(): McpServer {
    if (XeroMcpServer.instance === null) {
      XeroMcpServer.instance = XeroMcpServer.createServer();
    }
    return XeroMcpServer.instance;
  }

  public static CreateServerInstance(): McpServer {
    return XeroMcpServer.createServer();
  }
}
