#!/usr/bin/env node

import { createServer, type IncomingMessage } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
import { ToolFactory } from "./tools/tool-factory.js";

const normalizePath = (value: string): string => {
  const trimmed = value.trim();
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeading.length > 1 && withLeading.endsWith("/")) {
    return withLeading.slice(0, -1);
  }
  return withLeading;
};

const readJsonBody = async (req: IncomingMessage): Promise<unknown | undefined> => {
  return await new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
};

const startHttpTransport = async (server: ReturnType<typeof XeroMcpServer.GetServer>) => {
  const host = process.env.HTTP_HOST ?? "0.0.0.0";
  const parsedPort = Number(process.env.HTTP_PORT ?? "8080");
  const port = Number.isFinite(parsedPort) ? parsedPort : 8080;
  const mcpPath = normalizePath(process.env.HTTP_PATH ?? "/mcp");
  const healthPath = normalizePath(process.env.HEALTH_PATH ?? "/healthz");

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  const httpServer = createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    const hostHeader = req.headers.host;
    const baseUrl = hostHeader ? `http://${hostHeader}` : `http://${host}:${port}`;
    const { pathname } = new URL(req.url, baseUrl);

    if (pathname === healthPath) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    if (pathname !== mcpPath) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    try {
      if (req.method === "POST") {
        try {
          const body = await readJsonBody(req);
          await transport.handleRequest(req, res, body);
        } catch (error) {
          res.statusCode = 400;
          res.end("Invalid JSON body");
        }
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        await transport.handleRequest(req, res);
        return;
      }

      res.statusCode = 405;
      res.end("Method Not Allowed");
    } catch (error) {
      res.statusCode = 500;
      res.end("Internal Server Error");
      console.error("HTTP transport error:", error);
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`HTTP server failed to start: ${host}:${port} is already in use.`);
      }
      reject(error);
    });
    httpServer.listen(port, host, () => resolve());
  });

  console.log(`MCP transport: http (${host}:${port}${mcpPath})`);
  console.log(`Health endpoint: ${healthPath}`);
};

const main = async () => {
  // Create an MCP server
  const server = XeroMcpServer.GetServer();

  ToolFactory(server);

  const transportMode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();
  if (transportMode === "http") {
    await startHttpTransport(server);
    return;
  }

  // Avoid stdout/stderr logging in stdio mode to prevent protocol corruption.
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
