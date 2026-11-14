#!/usr/bin/env node
import { exec } from "child_process";
import http from "http";
import { URL } from "url";

import dotenv from "dotenv";
import { XeroClient } from "xero-node";

import { buildWebAuthConfig } from "./clients/xero-client.js";
import { saveTokenSet } from "./clients/token-store.js";

dotenv.config();

// One-time consent runner for XERO_AUTH_MODE=web.
//
// Builds the consent URL, opens it in the browser, runs a short-lived local
// HTTP server on the redirect URI to capture the authorization code, exchanges
// it for a tokenset (incl. refresh token), resolves the tenant, and persists
// everything to disk so the MCP server can run headless afterwards.

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      // Non-fatal: the URL is also printed for manual opening.
    }
  });
}

async function main(): Promise<void> {
  const config = buildWebAuthConfig();
  const redirectUri = config.redirectUris![0];
  const { hostname, port, pathname } = new URL(redirectUri);
  const listenPort = port ? Number(port) : 80;

  const xero = new XeroClient(config);
  await xero.initialize();

  const consentUrl = await xero.buildConsentUrl();

  console.log("\nXero web-auth consent");
  console.log("─".repeat(60));
  console.log("Open this URL in your browser if it doesn't open automatically:\n");
  console.log(consentUrl + "\n");
  console.log(`Waiting for the redirect to ${redirectUri} ...\n`);

  openBrowser(consentUrl);

  await new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) return;
        const requestUrl = new URL(req.url, `http://${hostname}:${listenPort}`);
        if (requestUrl.pathname !== pathname) {
          res.writeHead(404).end();
          return;
        }

        const fullCallbackUrl = redirectUri + requestUrl.search;
        const tokenSet = await xero.apiCallback(fullCallbackUrl);
        // false = skip per-org detail fetch (that needs accounting.settings);
        // /connections alone resolves the tenantId.
        const tenants = await xero.updateTenants(false);
        const tenant = tenants?.[0];

        saveTokenSet({ ...tokenSet, tenantId: tenant?.tenantId });

        res.writeHead(200, { "Content-Type": "text/html" }).end(
          "<h2>Xero connected ✓</h2><p>You may close this tab and return to the terminal.</p>",
        );

        console.log("✓ Tokenset saved.");
        if (tenant) {
          console.log(`✓ Connected tenant: ${tenant.tenantName} (${tenant.tenantId})`);
        }

        server.close();
        resolve();
      } catch (error) {
        res
          .writeHead(500, { "Content-Type": "text/html" })
          .end("<h2>Auth failed</h2><p>Check the terminal for details.</p>");
        server.close();
        reject(error);
      }
    });

    server.on("error", reject);
    server.listen(listenPort, hostname);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nAuth error:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
