import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import { rename, writeFile } from "node:fs/promises";
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
const refresh_token = process.env.XERO_REFRESH_TOKEN;
const refresh_token_file = process.env.XERO_REFRESH_TOKEN_FILE;
const grant_type = "client_credentials";
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

if (!bearer_token && (!client_id || !client_secret)) {
  throw Error("Environment Variables not set - please check your .env file");
}

if (refresh_token && (!client_id || !client_secret)) {
  throw Error(
    "XERO_REFRESH_TOKEN requires XERO_CLIENT_ID and XERO_CLIENT_SECRET",
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
      throw new Error(
        `Failed to get Xero token: ${axiosError.response?.data || axiosError.message}`,
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

class RefreshTokenXeroClient extends MCPXeroClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshTokenFile?: string;
  private currentRefreshToken: string;
  private accessTokenExpiresAt?: number;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    refreshTokenFile?: string;
  }) {
    super();
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.currentRefreshToken = config.refreshToken;
    this.refreshTokenFile = config.refreshTokenFile;
  }

  private isAccessTokenExpiringSoon(): boolean {
    if (!this.accessTokenExpiresAt) {
      return true;
    }

    return Date.now() >= this.accessTokenExpiresAt - EXPIRY_BUFFER_MS;
  }

  private async persistRefreshToken(token: string): Promise<void> {
    if (!this.refreshTokenFile) {
      return;
    }

    const tmpPath = this.refreshTokenFile + ".tmp";
    await writeFile(tmpPath, token, { encoding: "utf8", mode: 0o600 });
    await rename(tmpPath, this.refreshTokenFile);
  }

  private async refreshAccessToken(): Promise<TokenSet> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");

    try {
      const response = await axios.post(
        "https://identity.xero.com/connect/token",
        `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.currentRefreshToken)}`,
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        },
      );

      const tokenSet = response.data as TokenSet;
      const nextRefreshToken = tokenSet.refresh_token;

      if (!tokenSet.access_token || !nextRefreshToken || !tokenSet.expires_in) {
        throw new Error("Xero token response missing required fields");
      }

      await this.persistRefreshToken(nextRefreshToken);
      this.currentRefreshToken = nextRefreshToken;

      const connectionsResponse = await axios.get(
        "https://api.xero.com/connections",
        {
          headers: {
            Authorization: `Bearer ${tokenSet.access_token}`,
            Accept: "application/json",
          },
        },
      );

      if (!connectionsResponse.data?.length) {
        throw new Error("No Xero tenants connected. Re-authorize the app.");
      }

      this.tenantId = connectionsResponse.data[0].tenantId;

      this.accessTokenExpiresAt = Date.now() + tokenSet.expires_in * 1000;

      return tokenSet;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        `Failed to refresh Xero token: ${axiosError.response?.data || axiosError.message}`,
      );
    }
  }

  async authenticate(): Promise<void> {
    if (!this.isAccessTokenExpiringSoon()) {
      return;
    }

    const tokenResponse = await this.refreshAccessToken();

    this.setTokenSet({
      access_token: tokenResponse.access_token,
      refresh_token: this.currentRefreshToken,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
    });
  }
}

export const xeroClient = bearer_token
  ? new BearerTokenXeroClient({
      bearerToken: bearer_token,
    })
  : refresh_token
    ? new RefreshTokenXeroClient({
        clientId: client_id!,
        clientSecret: client_secret!,
        refreshToken: refresh_token,
        refreshTokenFile: refresh_token_file,
      })
    : new CustomConnectionsXeroClient({
        clientId: client_id!,
        clientSecret: client_secret!,
        grantType: grant_type,
      });
