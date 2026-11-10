import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import {
  IXeroClientConfig,
  Organisation,
  TokenSet,
  XeroClient,
} from "xero-node";

import {
  persistTokens,
  readTokens,
  stampExpiry,
  TokenStore,
} from "../auth/token-store.js";
import { ensureError } from "../helpers/ensure-error.js";

dotenv.config();

const client_id = process.env.XERO_CLIENT_ID;
const client_secret = process.env.XERO_CLIENT_SECRET;
const bearer_token = process.env.XERO_CLIENT_BEARER_TOKEN;
const token_file = process.env.XERO_TOKEN_FILE;
const grant_type = "client_credentials";

if (!token_file && !bearer_token && (!client_id || !client_secret)) {
  throw Error("Environment Variables not set - please check your .env file");
}

// XERO_TOKEN_FILE mode reads an OAuth2 token store (authorization-code flow with
// offline_access) and self-refreshes via the rolling refresh token. Free, works
// in every region, and never lapses mid-session — unlike static bearer tokens.
if (token_file && (!client_id || !client_secret)) {
  throw Error(
    "XERO_TOKEN_FILE mode requires XERO_CLIENT_ID and XERO_CLIENT_SECRET " +
      "(set XERO_TENANT_ID to pin a single org when the token has several connected)",
  );
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

  // Legacy scopes (deprecated but still supported for existing apps)
  private readonly XERO_DEFAULT_AUTH_SCOPES_V1 = [
    "accounting.transactions",
    "accounting.contacts",
    "accounting.settings",
    "accounting.reports.read",
    "payroll.settings",
    "payroll.employees",
    "payroll.timesheets",
  ].join(" ");

  // Granular scopes (required for new apps)
  private readonly XERO_DEFAULT_AUTH_SCOPES_V2 = [
    "accounting.invoices",
    "accounting.payments",
    "accounting.banktransactions",
    "accounting.manualjournals",
    "accounting.reports.aged.read",
    "accounting.reports.balancesheet.read",
    "accounting.reports.profitandloss.read",
    "accounting.reports.trialbalance.read",
    "accounting.contacts",
    "accounting.settings",
    "payroll.settings",
    "payroll.employees",
    "payroll.timesheets",
  ].join(" ");

  constructor(config: {
    clientId: string;
    clientSecret: string;
    grantType: string;
  }) {
    super(config);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  private formatTokenError(error: unknown, context: string): Error {
    const axiosError = error as AxiosError;
    const data = axiosError.response?.data;
    const message =
      typeof data === "object"
        ? JSON.stringify(data)
        : data || axiosError.message;
    return new Error(`Failed to get Xero token${context}: ${message}`);
  }

  public async getClientCredentialsToken(): Promise<TokenSet> {
    // If XERO_SCOPES is set, use that
    if (process.env.XERO_SCOPES) {
      try {
        return await this.requestToken(process.env.XERO_SCOPES);
      } catch (envError) {
        throw this.formatTokenError(envError, " with XERO_SCOPES");
      }
    }

    // Else if XERO_SCOPES is not set, try V1 scopes first (for existing apps), fallback to V2 scopes (for new apps) only on invalid_scope error
    try {
      return await this.requestToken(this.XERO_DEFAULT_AUTH_SCOPES_V1);
    } catch (error) {
      const axiosError = error as AxiosError;
      const isInvalidScope =
        axiosError.response?.status === 400 &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (axiosError.response?.data as any)?.error === "invalid_scope";

      if (!isInvalidScope) {
        throw this.formatTokenError(error, " with V1 scopes");
      }

      try {
        return await this.requestToken(this.XERO_DEFAULT_AUTH_SCOPES_V2);
      } catch (v2Error) {
        throw this.formatTokenError(v2Error, " with V2 scopes");
      }
    }
  }

  private async requestToken(scope: string): Promise<TokenSet> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");

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

/**
 * Auth mode that reads an OAuth2 token store from disk (a JSON file containing
 * at least `access_token` and `refresh_token`) and renews the access token via
 * the rolling refresh token when it is near expiry. The rotated refresh token is
 * persisted back atomically with 0600 permissions.
 *
 * This gives self-hosted/local users persistent, free authentication without a
 * paid Custom Connection — and works in every region. Because authenticate()
 * runs at the start of every handler, each tool call gets a valid token.
 *
 * Activated by XERO_TOKEN_FILE. Requires XERO_CLIENT_ID and XERO_CLIENT_SECRET
 * to perform the refresh. If XERO_TENANT_ID is set, the client is pinned to that
 * organisation (useful when the token has multiple tenants connected); otherwise
 * it falls back to the first connected tenant.
 */
class RefreshingTokenXeroClient extends MCPXeroClient {
  private readonly tokenFile: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tenantOverride?: string;

  constructor(config: {
    tokenFile: string;
    clientId: string;
    clientSecret: string;
    tenantId?: string;
  }) {
    super();
    this.tokenFile = config.tokenFile;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenantOverride = config.tenantId || undefined;
  }

  private async refresh(refreshToken: string): Promise<TokenStore> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");

    const response = await axios.post(
      "https://identity.xero.com/connect/token",
      `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      },
    );

    const tok = stampExpiry(response.data as TokenStore);
    persistTokens(this.tokenFile, tok);
    return tok;
  }

  public async authenticate(): Promise<void> {
    let tok = readTokens(this.tokenFile);
    const now = Math.floor(Date.now() / 1000);

    // Prefer an absolute expires_at; fall back to _obtained_at + expires_in;
    // if neither is present, treat as expired and refresh.
    const expiresAt =
      tok.expires_at ?? (tok._obtained_at ?? 0) + (tok.expires_in ?? 1800);

    // refresh with a 5-minute safety buffer
    if (now > expiresAt - 300) {
      tok = await this.refresh(tok.refresh_token);
    }

    this.setTokenSet({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_in: tok.expires_in,
      token_type: tok.token_type,
    });

    if (this.tenantOverride) {
      this.tenantId = this.tenantOverride;
    } else {
      await this.updateTenants();
    }
  }
}

export const xeroClient = token_file
  ? new RefreshingTokenXeroClient({
      tokenFile: token_file,
      clientId: client_id!,
      clientSecret: client_secret!,
      tenantId: process.env.XERO_TENANT_ID,
    })
  : bearer_token
    ? new BearerTokenXeroClient({
        bearerToken: bearer_token,
      })
    : new CustomConnectionsXeroClient({
        clientId: client_id!,
        clientSecret: client_secret!,
        grantType: grant_type,
      });
