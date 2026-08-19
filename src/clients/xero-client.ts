import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import {
  IXeroClientConfig,
  Organisation,
  TokenSet,
  XeroClient,
} from "xero-node";

import { ensureError } from "../helpers/ensure-error.js";
import { selectTenantId } from "./tenant-selection.js";

dotenv.config();

const client_id = process.env.XERO_CLIENT_ID;
const client_secret = process.env.XERO_CLIENT_SECRET;
const bearer_token = process.env.XERO_CLIENT_BEARER_TOKEN;
const grant_type = "client_credentials";
const OAUTH_TOKEN_ERROR_CODES = new Set([
  "invalid_request",
  "invalid_client",
  "invalid_grant",
  "unauthorized_client",
  "unsupported_grant_type",
  "invalid_scope",
  "server_error",
  "temporarily_unavailable",
]);

if (!bearer_token && (!client_id || !client_secret)) {
  throw Error("Environment Variables not set - please check your .env file");
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

  /**
   * Discards any cached authentication so the next authenticate() re-runs.
   * Called when Xero rejects a token that was still inside its cached
   * lifetime, which happens on a server-side revocation or a secret rotation.
   */
  public abstract invalidateAuthentication(): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override async updateTenants(fullOrgDetails?: boolean): Promise<any[]> {
    await super.updateTenants(fullOrgDetails);
    this.tenantId = selectTenantId(
      this.tenants ?? [],
      process.env.XERO_TENANT_ID,
    );
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

export class CustomConnectionsXeroClient extends MCPXeroClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private authenticatedUntil = 0;
  private authenticationPromise?: Promise<void>;

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
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    const oauthCode =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string" &&
      OAUTH_TOKEN_ERROR_CODES.has(data.error)
        ? data.error
        : undefined;
    const details = [
      Number.isInteger(status) ? `HTTP ${status}` : undefined,
      oauthCode ? `OAuth error: ${oauthCode}` : undefined,
    ].filter(Boolean);
    return new Error(
      `Failed to get Xero token${context}${
        details.length ? ` (${details.join("; ")})` : ""
      }`,
    );
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

    // Custom Connections are bound to one organisation and cannot call the
    // non-tenanted /connections endpoint. xero-node accepts an empty tenant ID
    // for their tenanted API calls.
    this.tenantId = "";

    return response.data;
  }

  private async refreshAuthentication(): Promise<void> {
    const tokenResponse = await this.getClientCredentialsToken();

    this.setTokenSet({
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
    });
    const candidateLifetime = Number(tokenResponse.expires_in);
    const lifetimeSeconds =
      Number.isFinite(candidateLifetime) && candidateLifetime > 0
        ? candidateLifetime
        : 0;
    const refreshSkewSeconds = Math.min(60, lifetimeSeconds / 2);
    this.authenticatedUntil =
      Date.now() + (lifetimeSeconds - refreshSkewSeconds) * 1000;
  }

  public async authenticate(): Promise<void> {
    if (Date.now() < this.authenticatedUntil) {
      return;
    }
    if (!this.authenticationPromise) {
      this.authenticationPromise = this.refreshAuthentication().finally(() => {
        this.authenticationPromise = undefined;
      });
    }
    await this.authenticationPromise;
  }

  public invalidateAuthentication(): void {
    this.authenticatedUntil = 0;
  }
}

export class BearerTokenXeroClient extends MCPXeroClient {
  private readonly bearerToken: string;
  private authenticated = false;
  private authenticationPromise?: Promise<void>;

  constructor(config: { bearerToken: string }) {
    super();
    this.bearerToken = config.bearerToken;
  }

  async authenticate(): Promise<void> {
    if (this.authenticated) {
      return;
    }
    if (!this.authenticationPromise) {
      this.authenticationPromise = (async () => {
        this.setTokenSet({
          access_token: this.bearerToken,
        });
        await this.updateTenants(false);
        this.authenticated = true;
      })().finally(() => {
        this.authenticationPromise = undefined;
      });
    }
    await this.authenticationPromise;
  }

  public invalidateAuthentication(): void {
    this.authenticated = false;
  }
}

export const xeroClient = bearer_token
  ? new BearerTokenXeroClient({
      bearerToken: bearer_token,
    })
  : new CustomConnectionsXeroClient({
      clientId: client_id!,
      clientSecret: client_secret!,
      grantType: grant_type,
    });

/**
 * Recognises a Xero API call rejected for authentication reasons. The token
 * endpoint is excluded: a failure there is already surfaced by the caller and
 * never leaves a cache entry behind.
 */
export function isXeroApiAuthFailure(error: unknown): boolean {
  const response = (error as AxiosError | undefined)?.response;
  if (response?.status !== 401) return false;

  const url = response.config?.url;
  if (!url) return false;

  try {
    const { hostname } = new URL(url);
    return hostname === "api.xero.com" || hostname.endsWith(".api.xero.com");
  } catch {
    return false;
  }
}

// xero-node issues every tenanted call through the default axios instance, so
// this is the one place a rejected cached token can be observed. Without it a
// revoked secret stays cached for the rest of the token lifetime.
axios.interceptors.response.use(undefined, (error: unknown) => {
  if (isXeroApiAuthFailure(error)) {
    xeroClient.invalidateAuthentication();
  }
  return Promise.reject(error);
});
