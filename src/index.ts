#!/usr/bin/env node

import "dotenv/config";

import { loadConfig, type TransportMode } from "./lib/config.js";
import { createLogger } from "./lib/logger.js";
import { runHttpServer } from "./server/transports/http.js";
import { runStdioServer } from "./server/transports/stdio.js";

function resolveTransportMode(
  argument: string | undefined,
  fallback: TransportMode,
): TransportMode {
  if (!argument) {
    return fallback;
  }

  if (argument === "http" || argument === "stdio") {
    return argument;
  }

  throw new Error(`Unknown transport "${argument}". Use "stdio" or "http".`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const transportMode = resolveTransportMode(process.argv[2], config.transportMode);
  const logger = createLogger(config.logLevel);

  if (transportMode === "http") {
    await runHttpServer(
      {
        ...config,
        transportMode,
      },
      logger,
    );
    return;
  }

  await runStdioServer();
}

main().catch((error) => {
  const configuredLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
  const logger = createLogger(
    configuredLevel === "debug" ||
      configuredLevel === "info" ||
      configuredLevel === "warn" ||
      configuredLevel === "error"
      ? configuredLevel
      : "info",
  );
  logger.error("startup_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
