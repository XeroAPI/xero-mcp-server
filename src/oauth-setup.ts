#!/usr/bin/env node
import http from "http";
import open from "open";
import axios from "axios";
import dotenv from "dotenv";
import crypto from "crypto";
import { saveTokens, StoredTokenSet } from "./helpers/token-storage.js";

dotenv.config();

const CLIENT_ID = process.env.XERO_CLIENT_ID;
const CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:5000/callback";
const SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.transactions",
  "accounting.contacts",
  "accounting.settings",
  "accounting.reports.read",
  "payroll.settings",
  "payroll.employees",
  "payroll.timesheets",
  "offline_access", // Required for refresh tokens
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Error: XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set in .env file");
  process.exit(1);
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function main() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const authUrl = new URL("https://login.xero.com/identity/connect/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log("\n========================================");
  console.log("  Xero OAuth2 Authorization Setup");
  console.log("========================================\n");
  console.log("This will open your browser to authorize the Xero MCP server.");
  console.log("After authorization, you'll be redirected back here.\n");

  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:5000`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          const errorDescription = url.searchParams.get("error_description");
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1 style="color: red;">Authorization Failed</h1>
                <p><strong>Error:</strong> ${error}</p>
                <p><strong>Description:</strong> ${errorDescription}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`OAuth error: ${error} - ${errorDescription}`));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1 style="color: red;">Security Error</h1>
                <p>State mismatch - possible CSRF attack.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error("State mismatch"));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1 style="color: red;">Error</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error("No authorization code"));
          return;
        }

        try {
          // Exchange code for tokens
          const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
          const tokenResponse = await axios.post(
            "https://identity.xero.com/connect/token",
            new URLSearchParams({
              grant_type: "authorization_code",
              code: code,
              redirect_uri: REDIRECT_URI,
              code_verifier: codeVerifier,
            }).toString(),
            {
              headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );

          const tokens: StoredTokenSet = {
            access_token: tokenResponse.data.access_token,
            refresh_token: tokenResponse.data.refresh_token,
            expires_at: Date.now() + tokenResponse.data.expires_in * 1000,
            token_type: tokenResponse.data.token_type,
            scope: tokenResponse.data.scope,
          };

          saveTokens(tokens);

          // Get connected organizations
          const connectionsResponse = await axios.get("https://api.xero.com/connections", {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              Accept: "application/json",
            },
          });

          const connections = connectionsResponse.data;

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1 style="color: green;">✓ Authorization Successful!</h1>
                <p>Tokens have been saved to <code>.xero-tokens.json</code></p>
                <h3>Connected Organizations:</h3>
                <ul>
                  ${connections.map((c: { tenantName: string; tenantId: string }) =>
                    `<li><strong>${c.tenantName}</strong> (${c.tenantId})</li>`
                  ).join("")}
                </ul>
                <p>You can now close this window and start the MCP server.</p>
              </body>
            </html>
          `);

          console.log("\n✓ Authorization successful!");
          console.log("\nConnected organizations:");
          connections.forEach((c: { tenantName: string; tenantId: string }) => {
            console.log(`  - ${c.tenantName} (${c.tenantId})`);
          });
          console.log("\nTokens saved to .xero-tokens.json");
          console.log("\nYou can now run the MCP server with:");
          console.log("  XERO_OAUTH_MODE=true node dist/index.js\n");

          server.close();
          resolve();
        } catch (err) {
          const axiosError = err as any;
          console.error("Token exchange failed:", axiosError.response?.data || axiosError.message);
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 40px;">
                <h1 style="color: red;">Token Exchange Failed</h1>
                <p>${axiosError.response?.data?.error_description || axiosError.message}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(err);
        }
      }
    });

    server.listen(5000, async () => {
      console.log("Listening for OAuth callback on http://localhost:5000/callback");
      console.log("\nOpening browser for authorization...\n");

      try {
        await open(authUrl.toString());
      } catch {
        console.log("Could not open browser automatically.");
        console.log("Please open this URL manually:\n");
        console.log(authUrl.toString());
        console.log();
      }
    });

    server.on("error", (err) => {
      console.error("Server error:", err);
      reject(err);
    });
  });
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
