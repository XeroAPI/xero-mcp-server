import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import {
  IXeroClientConfig,
  Organisation,
  TokenSet,
  XeroClient,
} from "xero-node";

import { ensureError } from "../helpers/ensure-error.js";

dotenv.config();

const client_id = process.env.XERO_CLIENT_ID;
const client_secret = process.env.XERO_CLIENT_SECRET;
const bearer_token = process.env.XERO_CLIENT_BEARER_TOKEN;
const grant_type = "client_credentials";

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
      typeof data === "object" ? JSON.stringify(data) : data || axiosError.message;
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

export const xeroClient = bearer_token
  ? new BearerTokenXeroClient({
      bearerToken: bearer_token,
    })
  : new CustomConnectionsXeroClient({
      clientId: client_id!,
      clientSecret: client_secret!,
      grantType: grant_type,
    });
