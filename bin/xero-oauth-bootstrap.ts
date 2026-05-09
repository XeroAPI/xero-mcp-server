#!/usr/bin/env -S npx tsx
/**
 * Bootstrap a per-user Xero refresh token and store it in GCP Secret Manager.
 *
 *   npx tsx bin/xero-oauth-bootstrap.ts \
 *     --user jesse \
 *     --project swiftotter-xero-mcp \
 *     --client-id $XERO_APP_CLIENT_ID \
 *     --client-secret $XERO_APP_CLIENT_SECRET
 *
 * Run once per teammate. The user signs in at Xero in the browser, approves
 * the SwiftOtter MCP app, and a refresh token lands in Secret Manager as
 * `refresh-token-<user>`. Pass that to scripts/deploy-user.sh.
 */
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { URL, URLSearchParams } from "node:url";

const DEFAULT_SCOPES =
  "offline_access accounting.transactions accounting.contacts accounting.settings accounting.reports.read accounting.attachments payroll.settings payroll.employees payroll.timesheets";
const AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";

type Args = {
  user: string;
  project: string;
  clientId: string;
  clientSecret: string;
  port: number;
  scopes: string;
};

function parseArgs(argv: string[]): Args {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const key = flag.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    out[key] = value;
    i++;
  }
  const required = ["user", "project", "client-id", "client-secret"];
  for (const r of required) {
    if (!out[r]) {
      throw new Error(`Missing --${r}`);
    }
  }
  if (!/^[a-z0-9-]+$/.test(out["user"])) {
    throw new Error(
      "--user must be lowercase letters, digits, or hyphens (used in secret name)",
    );
  }
  return {
    user: out["user"],
    project: out["project"],
    clientId: out["client-id"],
    clientSecret: out["client-secret"],
    port: out["port"] ? Number(out["port"]) : 54321,
    scopes: out["scopes"] ?? DEFAULT_SCOPES,
  };
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function waitForCode(
  port: number,
  expectedState: string,
): Promise<{ code: string; redirectUri: string }> {
  const redirectUri = `http://localhost:${port}/callback`;
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? "/", redirectUri);
        if (url.pathname !== "/callback") {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        if (error) {
          res.statusCode = 400;
          res.end(`Xero returned an error: ${error}`);
          server.close();
          reject(new Error(`Xero authorize error: ${error}`));
          return;
        }
        if (state !== expectedState) {
          res.statusCode = 400;
          res.end("State mismatch — aborting");
          server.close();
          reject(new Error("State mismatch in OAuth callback"));
          return;
        }
        if (!code) {
          res.statusCode = 400;
          res.end("No authorization code");
          server.close();
          reject(new Error("No authorization code in callback"));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          "<h1>Authorized</h1><p>You can close this tab and return to the terminal.</p>",
        );
        server.close();
        resolve({ code, redirectUri });
      } catch (err) {
        server.close();
        reject(err);
      }
    });
    server.listen(port, "127.0.0.1");
    server.on("error", reject);
  });
}

async function exchangeCode(
  args: Args,
  code: string,
  redirectUri: string,
  verifier: string,
): Promise<{ refresh_token: string; access_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const credentials = Buffer.from(
    `${args.clientId}:${args.clientSecret}`,
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const json = JSON.parse(text) as {
    refresh_token?: string;
    access_token?: string;
  };
  if (!json.refresh_token || !json.access_token) {
    throw new Error(`Token response missing refresh_token: ${text}`);
  }
  return {
    refresh_token: json.refresh_token,
    access_token: json.access_token,
  };
}

async function storeRefreshToken(
  project: string,
  user: string,
  refreshToken: string,
): Promise<string> {
  const client = new SecretManagerServiceClient();
  const secretId = `refresh-token-${user}`;
  const parent = `projects/${project}`;
  const secretName = `${parent}/secrets/${secretId}`;

  try {
    await client.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
    console.log(`Created secret ${secretName}`);
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (/already exists/i.test(msg) || /6 ALREADY_EXISTS/.test(msg)) {
      console.log(`Secret ${secretName} already exists — adding new version`);
    } else {
      throw err;
    }
  }

  const [version] = await client.addSecretVersion({
    parent: secretName,
    payload: { data: Buffer.from(refreshToken, "utf8") },
  });
  console.log(`Wrote version ${version.name}`);
  return secretName;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { verifier, challenge } = pkce();
  const state = base64url(randomBytes(16));
  const redirectUri = `http://localhost:${args.port}/callback`;

  const authorizeUrl = new URL(AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", args.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", args.scopes);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  console.log("");
  console.log(`Open this URL in a browser logged in as ${args.user}:`);
  console.log("");
  console.log(`  ${authorizeUrl.toString()}`);
  console.log("");
  console.log(`Listening on ${redirectUri} for the callback...`);

  const { code } = await waitForCode(args.port, state);
  console.log("Got authorization code, exchanging for tokens...");
  const tokens = await exchangeCode(args, code, redirectUri, verifier);

  const secretName = await storeRefreshToken(
    args.project,
    args.user,
    tokens.refresh_token,
  );

  console.log("");
  console.log("Done.");
  console.log("");
  console.log(`Secret name (for deploy-user.sh):`);
  console.log(`  ${secretName}`);
  console.log("");
  console.log("Next: ./scripts/deploy-user.sh", args.user, "<user-email>");
}

main().catch((err) => {
  console.error("Bootstrap failed:", err.message ?? err);
  process.exit(1);
});
