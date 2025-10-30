#!/usr/bin/env node

/**
 * Simple harness that spins up the HTTP MCP server, authenticates with the configured
 * MCP_API_KEY, and runs a read-only tool (defaults to list-organisation-details).
 *
 * Usage:
 *   MCP_API_KEY=secret XERO_CLIENT_ID=... XERO_CLIENT_SECRET=... node examples/http-read-only-test.mjs
 *
 * Optional environment variables:
 *   MCP_TEST_TOOL   - tool name to call (default: list-organisation-details)
 *   MCP_TEST_PORT   - port to bind the HTTP server (default: 3300)
 *   MCP_TEST_HOST   - host to bind the HTTP server (default: 127.0.0.1)
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";
import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

dotenv.config();

const TOOL_NAME = process.env.MCP_TEST_TOOL ?? "list-organisation-details";
const HOST = process.env.MCP_TEST_HOST ?? "127.0.0.1";
const PORT = Number.parseInt(process.env.MCP_TEST_PORT ?? "3300", 10);
const API_KEY = process.env.MCP_API_KEY ?? "";
const SKIP_SPAWN = process.env.MCP_TEST_SKIP_SPAWN === "true";

if (!API_KEY) {
  console.error("MCP_API_KEY must be set to authenticate against the HTTP server.");
  process.exit(1);
}

const serverEnv = {
  ...process.env,
  HOST,
  PORT: String(PORT),
};

const server = SKIP_SPAWN
  ? null
  : spawn("node", ["dist/server.js"], {
      env: serverEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

const cleanup = async () => {
  if (!server || SKIP_SPAWN || server.killed) {
    return;
  }
  if (!server.killed) {
    server.kill();
    await once(server, "exit").catch(() => {});
  }
};

if (server) {
  server.on("exit", (code, signal) => {
    if (code !== 0) {
      console.error(`HTTP server exited unexpectedly (code=${code}, signal=${signal})`);
    }
  });

  server.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });
}

const waitForServer = async () => {
  if (SKIP_SPAWN) {
    const healthUrl = new URL(`http://${HOST}:${PORT}/healthz`);
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(healthUrl);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Swallow and retry until deadline expires
      }
      await delay(250);
    }
    throw new Error(`Timed out waiting for remote server at ${healthUrl.href}`);
  }

  if (!server) {
    throw new Error("Server process not started and SKIP_SPAWN disabled.");
  }

  const readline = createInterface({ input: server.stdout });
  try {
    for await (const line of readline) {
      if (line.includes("HTTP MCP server listening")) {
        return;
      }
      process.stdout.write(`${line}\n`);
    }
  } finally {
    readline.close();
  }

  throw new Error("Server exited before signaling readiness.");
};

const run = async () => {
  await waitForServer();

  const serverUrl = new URL(`http://${HOST}:${PORT}/mcp`);
  const headers = { Authorization: `Bearer ${API_KEY}` };

  const transport = new SSEClientTransport(serverUrl, {
    requestInit: { headers },
    eventSourceInit: {
      fetch: async (resource, init) => {
        const mergedHeaders = new Headers(init?.headers ?? {});
        mergedHeaders.set("Authorization", `Bearer ${API_KEY}`);
        return fetch(resource, { ...init, headers: mergedHeaders });
      },
    },
  });

  const client = new Client(
    { name: "xero-mcp-read-test", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  try {
    await client.connect(transport);
    console.log(`Connected to MCP server at ${serverUrl.href}`);

    const tools = await client.listTools({});
    const hasTool = tools.tools.some((tool) => tool.name === TOOL_NAME);
    if (!hasTool) {
      throw new Error(
        `Tool "${TOOL_NAME}" not advertised by server. Available tools: ${tools.tools
          .map((tool) => tool.name)
          .join(", ")}`,
      );
    }

    console.log(`Calling read-only tool "${TOOL_NAME}"...`);
    const result = await client.callTool({
      name: TOOL_NAME,
      arguments: {},
    });

    console.log("Tool response:");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close().catch(() => {});
    await cleanup();
  }
};

run()
  .then(() => delay(100))
  .catch(async (error) => {
    console.error("Read-only harness failed:", error);
    await cleanup();
    process.exit(1);
  });
