#!/usr/bin/env node

/**
 * Xero MCP Server - HTTP entrypoint with optional MCPfy Pulse telemetry
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getPackageVersion } from "./helpers/get-package-version.js";
import { logPulseStatus, wrapTransportWithPulse } from "./mcpfy/pulse.js";
import { ToolFactory } from "./tools/tool-factory.js";

function parsePort(): number {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${process.env.PORT ?? 3000}`);
  }
  return port;
}

function createXeroServer(): McpServer {
  const server = new McpServer({
    name: "Xero MCP Server",
    version: getPackageVersion(),
  });

  ToolFactory(server);
  return server;
}

function methodNotAllowed(res: import("express").Response): void {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
}

async function main(): Promise<void> {
  const port = parsePort();
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  app.post("/mcp", async (req, res) => {
    const server = createXeroServer();

    try {
      const transport = wrapTransportWithPulse(
        new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        }),
      );

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (_req, res) => {
    methodNotAllowed(res);
  });

  app.delete("/mcp", (_req, res) => {
    methodNotAllowed(res);
  });

  logPulseStatus();

  await new Promise<void>((resolve, reject) => {
    app.listen(port, "0.0.0.0", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      console.error(
        `MCP server listening on http://0.0.0.0:${port}/mcp (port ${port})`,
      );
      resolve();
    });
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Error:", message);
  process.exit(1);
});
