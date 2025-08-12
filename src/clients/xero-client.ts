import axios, { AxiosError } from "axios";
import {
  IXeroClientConfig,
  Organisation,
  XeroClient,
} from "xero-node";

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
        // Provide more specific error handling
        if (error instanceof Error) {
          throw new Error(
            `Failed to get Organisation short code for tenant ID: ${this.tenantId} - ${error.message}`,
          );
        } else {
          throw new Error(
            `Failed to get Organisation short code for tenant ID: ${this.tenantId} - ${String(error)}`,
          );
        }
      }
    }
    return this.shortCode;
  }
}

// CustomConnectionsXeroClient removed - only BearerTokenXeroClient is used

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

    // Get tenant ID from connections endpoint first
    try {
      const connectionsResponse = await axios.get(
        "https://api.xero.com/connections",
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            Accept: "application/json",
          },
        },
      );

      if (connectionsResponse.data && connectionsResponse.data.length > 0) {
        this.tenantId = connectionsResponse.data[0].tenantId;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorDetail = axiosError.response?.data && typeof axiosError.response.data === 'object' && 'Detail' in axiosError.response.data
        ? (axiosError.response.data as any).Detail
        : axiosError.message;
      throw new Error(
        `Failed to get Xero connections for tenant ID in BearerTokenXeroClient: ${this.tenantId} - ${errorDetail}`,
      );
    }

    await this.updateTenants();
  }
}

// Factory function to create Xero client with bearer token
export function createXeroClient(bearerToken: string): MCPXeroClient {
  if (!bearerToken || bearerToken.trim() === "") {
    throw Error("Bearer token must be provided for Xero authentication");
  }

  return new BearerTokenXeroClient({
    bearerToken: bearerToken,
  });
}

// Legacy singleton removed - each tool call should create its own client with bearer token
