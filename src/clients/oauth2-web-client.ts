import * as http from "http";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { XeroClient } from "xero-node";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const TOKEN_FILE = path.join(os.homedir(), ".xero-mcp-tokens.json");

const OAUTH2_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.settings.read",
  "accounting.contacts",
  "accounting.contacts.read",
  "accounting.invoices",
  "accounting.invoices.read",
  "accounting.payments",
  "accounting.payments.read",
  "accounting.banktransactions",
  "accounting.banktransactions.read",
  "accounting.manualjournals",
  "accounting.manualjournals.read",
  "accounting.reports.profitandloss.read",
  "accounting.reports.balancesheet.read",
  "accounting.reports.trialbalance.read",
  "accounting.reports.aged.read",
].join(" ");

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
  tenant_id: string;
}

function loadTokens(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return null;
}

function saveTokens(data: TokenData): void {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf8");
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.error(`[xero-mcp] Could not open browser automatically. Please open this URL:\n${url}`);
    }
  });
}

async function fetchTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function getTenantId(accessToken: string): Promise<string> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get connections: ${res.status} ${text}`);
  }

  const connections: Array<{ tenantId: string; tenantName: string; tenantType: string }> =
    await res.json();

  if (connections.length === 0) {
    throw new Error("No Xero organisations found. Make sure you authorised access to an organisation.");
  }

  if (connections.length === 1) {
    console.error(`[xero-mcp] Connected to organisation: ${connections[0].tenantName}`);
    return connections[0].tenantId;
  }

  // Multiple orgs — pick the first and log a warning
  console.error(
    `[xero-mcp] Multiple organisations found. Using: ${connections[0].tenantName}.`
  );
  console.error(
    `[xero-mcp] To use a different org, delete ${TOKEN_FILE} and re-authenticate.`
  );
  return connections[0].tenantId;
}

function waitForAuthCode(
  port: number,
  callbackPath: string,
  expectedState: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);
      if (url.pathname !== callbackPath) {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<html><body><h2>Authentication failed: ${error}</h2><p>You can close this tab.</p></body></html>`);
        server.close();
        reject(new Error(`OAuth2 error: ${error}`));
        return;
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<html><body><h2>Invalid callback</h2><p>You can close this tab.</p></body></html>`);
        server.close();
        reject(new Error("Invalid OAuth2 callback — missing code or state mismatch"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<html><body><h2>✅ Xero connected successfully!</h2><p>You can close this tab and return to your AI assistant.</p></body></html>`
      );
      server.close();
      resolve(code);
    });

    server.listen(port, "localhost", () => {
      console.error(`[xero-mcp] Listening for OAuth2 callback on port ${port}...`);
    });

    server.on("error", reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth2 authentication timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

async function runAuthFlow(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TokenData> {
  const redirectUrl = new URL(redirectUri);
  const port = parseInt(redirectUrl.port || "80", 10);
  const callbackPath = redirectUrl.pathname || "/callback";

  // Generate PKCE
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  const state = base64UrlEncode(crypto.randomBytes(16));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: OAUTH2_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${XERO_AUTH_URL}?${params.toString()}`;
  console.error(`[xero-mcp] Opening browser for Xero authentication...`);
  console.error(`[xero-mcp] If the browser doesn't open, visit:\n${authUrl}`);

  // Start callback server before opening browser
  const codePromise = waitForAuthCode(port, callbackPath, state);
  openBrowser(authUrl);

  const code = await codePromise;
  console.error("[xero-mcp] Auth code received, exchanging for tokens...");

  const tokenResponse = await fetchTokens(code, codeVerifier, clientId, clientSecret, redirectUri);
  const tenantId = await getTenantId(tokenResponse.access_token);

  const tokenData: TokenData = {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at: Date.now() + tokenResponse.expires_in * 1000 - 60_000, // 1 min buffer
    tenant_id: tenantId,
  };

  saveTokens(tokenData);
  console.error("[xero-mcp] Tokens saved to", TOKEN_FILE);
  return tokenData;
}

/**
 * OAuth2WebXeroClient — uses the standard Authorization Code (PKCE) flow.
 * Works with a free Xero Web App (no paid Custom Connection required).
 */
export class OAuth2WebXeroClient extends XeroClient {
  public tenantId: string = "";
  private accessToken: string = "";
  private refreshToken: string = "";
  private expiresAt: number = 0;
  private shortCode: string = "";
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(config: { clientId: string; clientSecret: string; redirectUri: string }) {
    super({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUris: [config.redirectUri],
      httpTimeout: 30000,
      grantType: "authorization_code",
      state: true,
    });
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  async authenticate(): Promise<void> {
    // Try loading persisted tokens first
    const saved = loadTokens();

    if (saved) {
      // Valid and not expired
      if (Date.now() < saved.expires_at) {
        this.accessToken = saved.access_token;
        this.refreshToken = saved.refresh_token;
        this.expiresAt = saved.expires_at;
        this.tenantId = saved.tenant_id;
        // Set the token on the parent XeroClient
        this.setTokenSet({
          access_token: saved.access_token,
          refresh_token: saved.refresh_token,
        });
        return;
      }

      // Token expired — try to refresh
      if (saved.refresh_token) {
        try {
          const refreshed = await refreshAccessToken(
            saved.refresh_token,
            this.clientId,
            this.clientSecret
          );
          const tokenData: TokenData = {
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token || saved.refresh_token,
            expires_at: Date.now() + refreshed.expires_in * 1000 - 60_000,
            tenant_id: saved.tenant_id,
          };
          saveTokens(tokenData);
          this.accessToken = tokenData.access_token;
          this.refreshToken = tokenData.refresh_token;
          this.expiresAt = tokenData.expires_at;
          this.tenantId = tokenData.tenant_id;
          this.setTokenSet({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
          });
          console.error("[xero-mcp] Access token refreshed successfully.");
          return;
        } catch (err) {
          console.error("[xero-mcp] Token refresh failed, re-authenticating...", err);
        }
      }
    }

    // No valid tokens — run the full browser auth flow
    const tokenData = await runAuthFlow(this.clientId, this.clientSecret, this.redirectUri);
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;
    this.expiresAt = tokenData.expires_at;
    this.tenantId = tokenData.tenant_id;
    this.setTokenSet({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });
  }

  /**
   * Returns the Xero organisation short code (used for deep links).
   * Cached after first call.
   */
  public async getShortCode(): Promise<string | undefined> {
    if (!this.shortCode) {
      await this.authenticate();
      const organisationResponse = await this.accountingApi.getOrganisations(
        this.tenantId || "",
      );
      const organisation = organisationResponse.body.organisations?.[0];
      if (!organisation) {
        throw new Error("Failed to retrieve organisation");
      }
      this.shortCode = organisation.shortCode ?? "";
    }
    return this.shortCode;
  }
}
