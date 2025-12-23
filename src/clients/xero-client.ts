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

const logAuthConfig = () => {
  console.log("Xero auth configuration:");
  console.log(`- XERO_CLIENT_ID set: ${Boolean(client_id)}`);
  console.log(`- XERO_CLIENT_SECRET set: ${Boolean(client_secret)}`);
  console.log(`- XERO_CLIENT_BEARER_TOKEN set: ${Boolean(bearer_token)}`);
  console.log(
    `- Auth mode: ${bearer_token ? "bearer token" : "custom connection"}`,
  );
};

logAuthConfig();

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
    if (!this.tenantId) {
      console.warn("No Xero tenant ID resolved from /connections.");
    } else {
      console.log(`Using Xero tenant ID: ${this.tenantId}`);
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
      console.log("Requesting Xero access token via client credentials.");
      console.log(`- Client ID length: ${this.clientId.length}`);
      console.log(`- Client Secret length: ${this.clientSecret.length}`);
      console.log(`- Token scope: ${scope}`);
      console.log(
        "- Token request Authorization header: Basic <redacted>",
      );
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
      console.log(`Token response status: ${response.status}`);

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
      console.log(`Connections response status: ${connectionsResponse.status}`);

      if (connectionsResponse.data && connectionsResponse.data.length > 0) {
        this.tenantId = connectionsResponse.data[0].tenantId;
      } else {
        console.warn("No connections returned from Xero.");
      }

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error(
          `Xero token request failed with status ${axiosError.response.status}.`,
        );
      }
      throw new Error(
        `Failed to get Xero token: ${axiosError.response?.data || axiosError.message}`,
      );
    }
  }

  public async authenticate() {
    console.log("Authenticating with Xero using custom connection.");
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
    console.log("Authenticating with Xero using bearer token.");
    this.setTokenSet({
      access_token: this.bearerToken,
    });

    try {
      await this.updateTenants();
    } catch (error) {
      const err = ensureError(error);
      console.error(`Failed to update tenants with bearer token: ${err.message}`);
      throw error;
    }
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
