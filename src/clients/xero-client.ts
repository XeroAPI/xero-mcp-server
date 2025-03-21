import { XeroClient } from "xero-node";
import dotenv from "dotenv";
import axios, { AxiosError } from "axios";

dotenv.config();

const client_id = process.env.XERO_CLIENT_ID;
const client_secret = process.env.XERO_CLIENT_SECRET;
const grant_type = "client_credentials";

if (!client_id || !client_secret) {
  throw Error("Environment Variables not set - please check your .env file");
}

class CustomConnectionsXeroClient extends XeroClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private tenantId?: string;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    grantType: string;
  }) {
    super(config);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  async getClientCredentialsToken() {
    const scope =
      "accounting.transactions accounting.contacts accounting.settings.read";
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
    const tokenResponse = await xeroClient.getClientCredentialsToken();

    xeroClient.setTokenSet({
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
    });
  }

  // Override the buildHeaders method to include the tenant ID
  protected buildHeaders(
    bearerToken: string,
    contentType = "application/json",
  ): { [key: string]: string } {
    return {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": contentType,
      Accept: "application/json",
      "Xero-tenant-id": this.tenantId || "",
    };
  }
}

export const xeroClient = new CustomConnectionsXeroClient({
  clientId: client_id,
  clientSecret: client_secret,
  grantType: grant_type,
});
