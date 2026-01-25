import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL, URLSearchParams } from "url";
import crypto from "crypto";
import axios, { AxiosError } from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import open from "open";
import dotenv from "dotenv";
import {
  IXeroClientConfig,
  Organisation,
  TokenSet,
  XeroClient,
} from "xero-node";

import { ensureError } from "../helpers/ensure-error.js";

dotenv.config();

// Environment variables
const client_id = process.env.XERO_CLIENT_ID;
const client_secret = process.env.XERO_CLIENT_SECRET;
const bearer_token = process.env.XERO_CLIENT_BEARER_TOKEN;
const use_browser_auth = process.env.XERO_USE_BROWSER_AUTH === "true";
const scopes =
  process.env.XERO_SCOPES ||
  "accounting.transactions accounting.contacts accounting.settings accounting.reports.read";
const grant_type = "client_credentials";

// OAuth browser flow constants
const TOKEN_FILE = path.join(os.homedir(), ".xero-mcp-tokens.json");
const CALLBACK_PORT = 8749; // Uncommon port to avoid conflicts
const CALLBACK_PATH = "/callback";
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
const AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";

// Validate environment variables based on auth method
if (use_browser_auth) {
  if (!client_id || !client_secret) {
    throw Error(
      "XERO_USE_BROWSER_AUTH=true requires XERO_CLIENT_ID and XERO_CLIENT_SECRET"
    );
  }
} else if (!bearer_token && (!client_id || !client_secret)) {
  throw Error("Environment Variables not set - please check your .env file");
}

// PKCE helpers
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Token storage interface
interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  id_token?: string;
  scope: string;
}

// Base class for all MCP Xero clients
abstract class MCPXeroClient extends XeroClient {
  public tenantId: string;
  private shortCode: string;

  protected constructor(config?: IXeroClientConfig) {
    super(config);
    this.tenantId = "";
    this.shortCode = "";
  }

  public abstract authenticate(): Promise<void>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override async updateTenants(fullOrgDetails?: boolean): Promise<any[]> {
    await super.updateTenants(fullOrgDetails);
    if (this.tenants && this.tenants.length > 0) {
      this.tenantId = this.tenants[0].tenantId;
    }
    return this.tenants;
  }

  private async getOrganisation(): Promise<Organisation> {
    await this.authenticate();

    const organisationResponse = await this.accountingApi.getOrganisations(
      this.tenantId || ""
    );

    const organisation = organisationResponse.body.organisations?.[0];

    if (!organisation) {
      throw new Error("Failed to retrieve organisation");
    }

    return organisation;
  }

  public async getShortCode(): Promise<string | undefined> {
    if (!this.shortCode) {
      try {
        const organisation = await this.getOrganisation();
        this.shortCode = organisation.shortCode ?? "";
      } catch (error: unknown) {
        const err = ensureError(error);

        throw new Error(
          `Failed to get Organisation short code: ${err.message}`
        );
      }
    }
    return this.shortCode;
  }
}

// Custom Connections client (AU/NZ/UK/US only, requires subscription)
class CustomConnectionsXeroClient extends MCPXeroClient {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    grantType: string;
  }) {
    super(config);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  public async getClientCredentialsToken(): Promise<TokenSet> {
    const scope =
      "accounting.transactions accounting.contacts accounting.settings accounting.reports.read payroll.settings payroll.employees payroll.timesheets";
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    try {
      const response = await axios.post(
        "https://identity.xero.com/connect/token",
        `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`,
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        }
      );

      const token = response.data.access_token;
      const connectionsResponse = await axios.get(
        "https://api.xero.com/connections",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (connectionsResponse.data && connectionsResponse.data.length > 0) {
        this.tenantId = connectionsResponse.data[0].tenantId;
      }

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        `Failed to get Xero token: ${axiosError.response?.data || axiosError.message}`
      );
    }
  }

  public async authenticate() {
    const tokenResponse = await this.getClientCredentialsToken();

    this.setTokenSet({
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
    });
  }
}

// Bearer token client (manual token, no refresh)
class BearerTokenXeroClient extends MCPXeroClient {
  private readonly bearerToken: string;

  constructor(config: { bearerToken: string }) {
    super();
    this.bearerToken = config.bearerToken;
  }

  async authenticate(): Promise<void> {
    this.setTokenSet({
      access_token: this.bearerToken,
    });

    await this.updateTenants();
  }
}

// OAuth Browser client (works everywhere, auto-refresh)
class OAuthBrowserClient extends MCPXeroClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scopes: string;
  private tokens: StoredTokens | null = null;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    scopes: string;
  }) {
    super({ clientId: config.clientId, clientSecret: config.clientSecret });
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scopes = config.scopes;
  }

  public async authenticate(): Promise<void> {
    this.tokens = this.loadTokens();

    if (this.tokens) {
      const now = Date.now();
      const expiresAt = this.tokens.expires_at;
      const refreshThreshold = 5 * 60 * 1000; // 5 minutes

      if (expiresAt - now < refreshThreshold) {
        console.error("Token expiring soon, refreshing...");
        await this.refreshAccessToken();
      }
    } else {
      console.error(
        "No valid tokens found, starting browser authentication..."
      );
      await this.browserAuth();
    }

    this.setTokenSet({
      access_token: this.tokens!.access_token,
      refresh_token: this.tokens!.refresh_token,
      id_token: this.tokens!.id_token,
    });

    await this.updateTenants();
  }

  private async browserAuth(): Promise<void> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      scope: `openid profile email offline_access ${this.scopes}`,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${AUTHORIZE_URL}?${authParams.toString()}`;

    console.error("Opening browser for Xero authentication...");
    console.error(`If browser doesn't open, visit: ${authUrl}`);

    const callbackPromise = this.waitForCallback(state, codeVerifier);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await open(authUrl);

    await callbackPromise;
  }

  private waitForCallback(
    expectedState: string,
    codeVerifier: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(
            req.url || "",
            `http://localhost:${CALLBACK_PORT}`
          );

          if (url.pathname !== CALLBACK_PATH) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            res.writeHead(400);
            res.end(`Authentication failed: ${error}`);
            server.close();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (state !== expectedState) {
            res.writeHead(400);
            res.end("Invalid state parameter");
            server.close();
            reject(new Error("Invalid state parameter - possible CSRF attack"));
            return;
          }

          if (!code) {
            res.writeHead(400);
            res.end("No authorization code received");
            server.close();
            reject(new Error("No authorization code received"));
            return;
          }

          try {
            await this.exchangeCodeForTokens(code, codeVerifier);

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head><title>Xero MCP Authentication</title></head>
                <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                  <div style="text-align: center;">
                    <h1 style="color: #13B5EA;">Authentication Successful</h1>
                    <p>You can close this window and return to your terminal.</p>
                  </div>
                </body>
              </html>
            `);

            server.close();
            resolve();
          } catch (err) {
            res.writeHead(500);
            res.end("Failed to exchange token");
            server.close();
            reject(err);
          }
        }
      );

      server.listen(CALLBACK_PORT, () => {
        console.error(`Callback server listening on port ${CALLBACK_PORT}`);
      });

      setTimeout(() => {
        server.close();
        reject(new Error("Authentication timed out after 5 minutes"));
      }, 5 * 60 * 1000);
    });
  }

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string
  ): Promise<void> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    try {
      const response = await axios.post(
        TOKEN_URL,
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

      const { access_token, refresh_token, expires_in, id_token, scope } =
        response.data;

      this.tokens = {
        access_token,
        refresh_token,
        expires_at: Date.now() + expires_in * 1000,
        id_token,
        scope,
      };

      this.saveTokens(this.tokens);
      console.error("Authentication successful, tokens saved.");
    } catch (error) {
      const err = ensureError(error);
      throw new Error(`Failed to exchange code for tokens: ${err.message}`);
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refresh_token) {
      throw new Error("No refresh token available");
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    try {
      const response = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.tokens.refresh_token,
        }).toString(),
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token, refresh_token, expires_in, id_token, scope } =
        response.data;

      this.tokens = {
        access_token,
        refresh_token: refresh_token || this.tokens.refresh_token,
        expires_at: Date.now() + expires_in * 1000,
        id_token,
        scope,
      };

      this.saveTokens(this.tokens);
      console.error("Token refreshed successfully.");
    } catch (error) {
      const err = ensureError(error);
      console.error(`Failed to refresh token: ${err.message}`);
      this.deleteTokens();
      this.tokens = null;
      await this.browserAuth();
    }
  }

  private loadTokens(): StoredTokens | null {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data = fs.readFileSync(TOKEN_FILE, "utf-8");
        return JSON.parse(data) as StoredTokens;
      }
    } catch (error) {
      console.error("Failed to load tokens:", error);
    }
    return null;
  }

  private saveTokens(tokens: StoredTokens): void {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), {
        mode: 0o600,
      });
    } catch (error) {
      console.error("Failed to save tokens:", error);
    }
  }

  private deleteTokens(): void {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
    } catch (error) {
      console.error("Failed to delete tokens:", error);
    }
  }
}

// Select client based on environment configuration
function createXeroClient(): MCPXeroClient {
  if (use_browser_auth && client_id && client_secret) {
    console.error("Using OAuth browser authentication");
    return new OAuthBrowserClient({
      clientId: client_id,
      clientSecret: client_secret,
      scopes: scopes,
    });
  }

  if (bearer_token) {
    console.error("Using bearer token authentication");
    return new BearerTokenXeroClient({
      bearerToken: bearer_token,
    });
  }

  console.error("Using custom connections authentication");
  return new CustomConnectionsXeroClient({
    clientId: client_id!,
    clientSecret: client_secret!,
    grantType: grant_type,
  });
}

export const xeroClient = createXeroClient();
