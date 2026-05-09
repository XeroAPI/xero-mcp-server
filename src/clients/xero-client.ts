import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import { TokenSet } from "xero-node";

import { AuthorizationCodeXeroClient } from "./auth/authorization-code-xero-client.js";
import { MCPXeroClient } from "./auth/mcp-xero-client.js";

export { MCPXeroClient } from "./auth/mcp-xero-client.js";

dotenv.config();

const client_id = process.env.XERO_CLIENT_ID;
const client_secret = process.env.XERO_CLIENT_SECRET;
const bearer_token = process.env.XERO_CLIENT_BEARER_TOKEN;
const app_client_id = process.env.XERO_APP_CLIENT_ID;
const app_client_secret = process.env.XERO_APP_CLIENT_SECRET;
const refresh_token_secret_name = process.env.XERO_REFRESH_TOKEN_SECRET_NAME;
const grant_type = "client_credentials";

const has_authorization_code_config =
  Boolean(app_client_id) &&
  Boolean(app_client_secret) &&
  Boolean(refresh_token_secret_name);

if (
  !bearer_token &&
  !has_authorization_code_config &&
  (!client_id || !client_secret)
) {
  throw Error("Environment Variables not set - please check your .env file");
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
      process.env.XERO_SCOPES ||
      "accounting.transactions accounting.contacts accounting.settings accounting.reports.read accounting.attachments payroll.settings payroll.employees payroll.timesheets";
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
      const data = axiosError.response?.data;
      const detail =
        typeof data === "string"
          ? data
          : data
            ? JSON.stringify(data)
            : axiosError.message;
      throw new Error(`Failed to get Xero token: ${detail}`);
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

function buildXeroClient(): MCPXeroClient {
  if (bearer_token) {
    return new BearerTokenXeroClient({ bearerToken: bearer_token });
  }
  if (has_authorization_code_config) {
    return new AuthorizationCodeXeroClient({
      clientId: app_client_id!,
      clientSecret: app_client_secret!,
      secretName: refresh_token_secret_name!,
    });
  }
  return new CustomConnectionsXeroClient({
    clientId: client_id!,
    clientSecret: client_secret!,
    grantType: grant_type,
  });
}

export const xeroClient: MCPXeroClient = buildXeroClient();
