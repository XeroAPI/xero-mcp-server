import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import {
  IXeroClientConfig,
  Organisation,
  TokenSet,
  XeroClient,
} from "xero-node";

import { ensureError } from "../helpers/ensure-error.js";
import {
  loadTokens,
  saveTokens,
  isTokenExpired,
  tokenSetToStored,
  StoredTokenSet,
} from "../helpers/token-storage.js";

dotenv.config();

const client_id = process.env.XERO_CLIENT_ID;
const client_secret = process.env.XERO_CLIENT_SECRET;
const bearer_token = process.env.XERO_CLIENT_BEARER_TOKEN;
const oauth_mode = process.env.XERO_OAUTH_MODE === "true";
const grant_type = "client_credentials";

// Allow OAuth mode with client_id/secret, or bearer token, or custom connections
if (!bearer_token && !oauth_mode && (!client_id || !client_secret)) {
  throw Error("Environment Variables not set - please check your .env file");
}

if (oauth_mode && (!client_id || !client_secret)) {
  throw Error("XERO_OAUTH_MODE requires XERO_CLIENT_ID and XERO_CLIENT_SECRET");
}

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
      this.tenantId || "",
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
          `Failed to get Organisation short code: ${err.message}`,
        );
      }
    }
    return this.shortCode;
  }
}

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
      `${this.clientId}:${this.clientSecret}`,
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
        },
      );

      // Get the tenant ID from the connections endpoint
      const token = response.data.access_token;
      const connectionsResponse = await axios.get(
        "https://api.xero.com/connections",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (connectionsResponse.data && connectionsResponse.data.length > 0) {
        this.tenantId = connectionsResponse.data[0].tenantId;
      }

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data;

      console.error("\n========== XERO AUTHENTICATION ERROR ==========");
      console.error("Error Type: Client Credentials Authentication Failed");
      console.error(`Status: ${status} ${axiosError.response?.statusText || ""}`);
      console.error("Response:", JSON.stringify(responseData, null, 2));

      if (status === 401) {
        console.error("\n[401 Unauthorized] Invalid Client Credentials");
        console.error("Please verify:");
        console.error("  1. XERO_CLIENT_ID is correct");
        console.error("  2. XERO_CLIENT_SECRET is correct");
        console.error("  3. Your Xero app is configured for Custom Connections");
      } else if (status === 403) {
        console.error("\n[403 Forbidden] Insufficient Permissions");
        console.error("Requested scopes:", scope);
        console.error("Please verify your app has the required scopes enabled.");
      } else if (!axiosError.response) {
        console.error("\n[Network Error] Unable to reach Xero API");
        console.error("Please check your internet connection and firewall settings.");
      }
      console.error("================================================\n");

      throw new Error(
        `Failed to get Xero token: ${JSON.stringify(responseData) || axiosError.message}`,
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

class OAuthXeroClient extends MCPXeroClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private currentTokens: StoredTokenSet | null = null;

  constructor(config: { clientId: string; clientSecret: string }) {
    super({ clientId: config.clientId, clientSecret: config.clientSecret });
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.currentTokens = loadTokens();
  }

  private async refreshAccessToken(): Promise<StoredTokenSet> {
    if (!this.currentTokens?.refresh_token) {
      throw new Error(
        "No refresh token available. Run the OAuth authorization flow first:\n" +
          "  node dist/oauth-setup.js"
      );
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    try {
      const response = await axios.post(
        "https://identity.xero.com/connect/token",
        `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.currentTokens.refresh_token)}`,
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        }
      );

      const newTokens: StoredTokenSet = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at: Date.now() + response.data.expires_in * 1000,
        token_type: response.data.token_type,
        scope: response.data.scope,
      };

      saveTokens(newTokens);
      this.currentTokens = newTokens;

      console.error("[Xero OAuth] Token refreshed successfully");
      return newTokens;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data;

      console.error("\n========== XERO OAUTH ERROR ==========");
      console.error("Error Type: Token Refresh Failed");
      console.error(`Status: ${status} ${axiosError.response?.statusText || ""}`);
      console.error("Response:", JSON.stringify(responseData, null, 2));

      if (status === 400 || status === 401) {
        console.error("\nThe refresh token may have expired or been revoked.");
        console.error("Please re-run the OAuth authorization flow:");
        console.error("  node dist/oauth-setup.js");
      }
      console.error("=======================================\n");

      throw new Error(
        `Failed to refresh Xero token: ${JSON.stringify(responseData) || axiosError.message}`
      );
    }
  }

  async authenticate(): Promise<void> {
    // Load tokens from storage if not already loaded
    if (!this.currentTokens) {
      this.currentTokens = loadTokens();
    }

    if (!this.currentTokens) {
      throw new Error(
        "No OAuth tokens found. Run the OAuth authorization flow first:\n" +
          "  node dist/oauth-setup.js"
      );
    }

    // Refresh if expired or about to expire
    if (isTokenExpired(this.currentTokens)) {
      console.error("[Xero OAuth] Token expired, refreshing...");
      await this.refreshAccessToken();
    }

    this.setTokenSet({
      access_token: this.currentTokens.access_token,
      refresh_token: this.currentTokens.refresh_token,
      token_type: this.currentTokens.token_type,
    });

    // Get tenant ID if we don't have it
    if (!this.tenantId) {
      try {
        const connectionsResponse = await axios.get(
          "https://api.xero.com/connections",
          {
            headers: {
              Authorization: `Bearer ${this.currentTokens.access_token}`,
              Accept: "application/json",
            },
          }
        );

        if (connectionsResponse.data && connectionsResponse.data.length > 0) {
          this.tenantId = connectionsResponse.data[0].tenantId;
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        console.error("Failed to get connections:", axiosError.message);
      }
    }
  }
}

export const xeroClient = bearer_token
  ? new BearerTokenXeroClient({
      bearerToken: bearer_token,
    })
  : oauth_mode
    ? new OAuthXeroClient({
        clientId: client_id!,
        clientSecret: client_secret!,
      })
    : new CustomConnectionsXeroClient({
        clientId: client_id!,
        clientSecret: client_secret!,
        grantType: grant_type,
      });
