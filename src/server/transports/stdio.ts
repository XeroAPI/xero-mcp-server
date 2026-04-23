import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createXeroMcpServer } from "../xero-mcp-server.js";

export async function runStdioServer(): Promise<void> {
  const server = createXeroMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
