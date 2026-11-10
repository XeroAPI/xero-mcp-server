import axios from "axios";
import { spawn } from "child_process";
import crypto from "crypto";
import http from "http";
import { URL } from "url";

import {
  DEFAULT_REDIRECT_URI,
  XERO_AUTHORIZE_URL,
  XERO_CONNECTIONS_URL,
  XERO_TOKEN_URL,
  resolveScopes,
} from "../consts/auth.js";
import { persistTokens, stampExpiry, TokenStore } from "./token-store.js";

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to complete login

// Everything the bootstrap is allowed to print goes to stderr — stdout is
// reserved for the MCP stdio transport on normal runs.
function log(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

// Open the system browser to the authorize URL. Single clear path per platform;
// on failure we fall through to printing the URL for manual paste.
//
// Alternative open methods for future reference:
// - npm pkg `open` (adds a dependency)
// - print-only: skip spawn entirely and always log the URL
function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    const child = spawn(cmd, [url], {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    });
    child.on("error", () => log(`Could not open browser. Open this URL manually:\n${url}`));
    child.unref();
  } catch {
    log(`Could not open browser. Open this URL manually:\n${url}`);
  }
}

/**
 * Wait for Xero to redirect back to the loopback callback with `?code=...`.
 * Resolves with the authorization code once a request matching the redirect
 * path arrives and the `state` matches; rejects on state mismatch, an OAuth
 * error param, or timeout. The server is always closed before settling.
 */
function waitForCallback(
  redirectUri: string,
  expectedState: string,
): Promise<string> {
  const { port, pathname } = new URL(redirectUri);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", redirectUri);
      if (reqUrl.pathname !== pathname) {
        res.writeHead(404).end();
        return;
      }

      const params = reqUrl.searchParams;
      const error = params.get("error");
      const code = params.get("code");
      const state = params.get("state");

      const finish = (status: number, body: string) => {
        res.writeHead(status, { "Content-Type": "text/html" });
        res.end(`<html><body><h2>${body}</h2>You can close this tab.</body></html>`);
        server.close();
        clearTimeout(timer);
      };

      if (error) {
        finish(400, `Authorization failed: ${error}`);
        reject(new Error(`Authorization failed: ${error}`));
      } else if (state !== expectedState) {
        finish(400, "State mismatch — aborting.");
        reject(new Error("State mismatch on OAuth callback (possible CSRF)"));
      } else if (!code) {
        finish(400, "No authorization code returned.");
        reject(new Error("No authorization code in callback"));
      } else {
        finish(200, "Authentication complete.");
        resolve(code);
      }
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for the OAuth callback"));
    }, CALLBACK_TIMEOUT_MS);

    server.on("error", reject);
    server.listen(Number(port), () =>
      log(`Listening for the Xero callback on ${redirectUri} ...`),
    );
  });
}

/** Exchange the authorization code for a token set (HTTP Basic client auth). */
async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenStore> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const body =
    `grant_type=authorization_code` +
    `&code=${encodeURIComponent(code)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const response = await axios.post(XERO_TOKEN_URL, body, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
  });
  return response.data as TokenStore;
}

/** Print the connected tenants so a multi-org user can set XERO_TENANT_ID. */
async function printConnections(accessToken: string): Promise<void> {
  try {
    const response = await axios.get(XERO_CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const connections = response.data as Array<{
      tenantId: string;
      tenantName?: string;
      tenantType?: string;
    }>;
    if (!connections.length) {
      log("No tenants connected yet.");
      return;
    }
    log(`\nConnected tenant(s) — set XERO_TENANT_ID to pin one:`);
    for (const c of connections) {
      log(`  ${c.tenantName ?? "(unnamed)"} [${c.tenantType ?? "?"}] -> ${c.tenantId}`);
    }
  } catch {
    // Non-fatal: the token is already saved; tenant listing is a convenience.
    log("Could not list connections (token saved regardless).");
  }
}

/**
 * Run the full OAuth2 authorization-code flow end to end: open the browser,
 * catch the redirect on a one-shot local server, exchange the code, and write
 * the token store that RefreshingTokenXeroClient consumes. No manual steps.
 *
 * Required env: XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_TOKEN_FILE, XERO_SCOPES.
 * Optional: XERO_REDIRECT_URI (defaults to the loopback callback).
 */
export async function runAuthorizationCodeFlow(): Promise<void> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const tokenFile = process.env.XERO_TOKEN_FILE;
  const redirectUri = process.env.XERO_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  const missing = [
    !clientId && "XERO_CLIENT_ID",
    !clientSecret && "XERO_CLIENT_SECRET",
    !tokenFile && "XERO_TOKEN_FILE",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing required env var(s): ${missing.join(", ")}`);
  }

  const scope = resolveScopes(); // throws if XERO_SCOPES unset
  const state = crypto.randomBytes(16).toString("hex");

  const authorizeUrl = new URL(XERO_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId!);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  // Start listening before opening the browser so the redirect can't race us.
  const codePromise = waitForCallback(redirectUri, state);
  log("Opening your browser to authorize with Xero ...");
  openBrowser(authorizeUrl.toString());

  const code = await codePromise;
  log("Authorization code received. Exchanging for tokens ...");

  const tok = stampExpiry(
    await exchangeCode(code, redirectUri, clientId!, clientSecret!),
  );
  persistTokens(tokenFile!, tok);
  log(`Tokens written to ${tokenFile} (mode 0600).`);

  await printConnections(tok.access_token);
  log("\nDone. Start the server normally with the same env to use it.");
}
