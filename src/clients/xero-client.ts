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
  private readonly LEGACY_SCOPES = [
    "accounting.transactions",
    "accounting.contacts",
    "accounting.settings",
    "accounting.reports.read",
    "payroll.settings",
    "payroll.employees",
    "payroll.timesheets",
  ].join(" ");

  // Granular scopes (required for new apps)
  private readonly GRANULAR_SCOPES = [
    "accounting.invoices",
    "accounting.invoices.read",
    "accounting.payments",
    "accounting.payments.read",
    "accounting.banktransactions",
    "accounting.banktransactions.read",
    "accounting.manualjournals",
    "accounting.manualjournals.read",
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

  public async getClientCredentialsToken(): Promise<TokenSet> {
    // Try legacy scopes first (for existing apps), fallback to granular scopes (for new apps)
    try {
      return await this.requestToken(this.LEGACY_SCOPES);
    } catch {
      try {
        return await this.requestToken(this.GRANULAR_SCOPES);
      } catch (error) {
        const axiosError = error as AxiosError;
        throw new Error(
          `Failed to get Xero token: ${
            typeof axiosError.response?.data === "object"
              ? JSON.stringify(axiosError.response?.data)
              : axiosError.response?.data || axiosError.message
          }`,
        );
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
