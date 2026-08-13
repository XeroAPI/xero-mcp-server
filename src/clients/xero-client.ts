import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import {
  IXeroClientConfig,
  Organisation,
  TokenSet,
  XeroClient,
} from "xero-node";

import { formatError } from "../helpers/format-error.js";

dotenv.config();

const client_id = process.env.XERO_CLIENT_ID;
const client_secret = process.env.XERO_CLIENT_SECRET;
const bearer_token = process.env.XERO_CLIENT_BEARER_TOKEN;
const grant_type = "client_credentials";

if (!bearer_token && (!client_id || !client_secret)) {
  throw Error("Environment Variables not set - please check your .env file");
}

export abstract class MCPXeroClient extends XeroClient {
  // Short codes are cached per logical tenant. A single cached value would leak
  // one organisation's deep links into another organisation's responses.
  private readonly shortCodes = new Map<string, string>();

  protected constructor(config?: IXeroClientConfig) {
    super(config);
  }

  public abstract authenticate(): Promise<void>;

  public async getOrganisation(apiTenantId: string): Promise<Organisation> {
    const organisationResponse =
      await this.accountingApi.getOrganisations(apiTenantId);

    const organisation = organisationResponse.body.organisations?.[0];

    if (!organisation) {
      throw new Error("Failed to retrieve organisation");
    }

    return organisation;
  }

  public async getShortCode(
    tenantId: string,
    apiTenantId: string,
  ): Promise<string | undefined> {
    const cached = this.shortCodes.get(tenantId);

    if (cached) {
      return cached;
    }

    try {
      const organisation = await this.getOrganisation(apiTenantId);
      const shortCode = organisation.shortCode ?? "";
      this.shortCodes.set(tenantId, shortCode);
      return shortCode;
    } catch (error: unknown) {
      // formatError is the redaction boundary: never stringify raw SDK errors,
      // whose request headers carry the caller's token.
      throw new Error(
        `Failed to get Organisation short code: ${formatError(error)}`,
      );
    }
  }
}

export class CustomConnectionsXeroClient extends MCPXeroClient {
  private readonly clientId: string;
  private readonly clientSecret: string;

  // Identifiers the credential itself can prove, learned from the /connections
  // response at token acquisition. A Custom Connection is bound to exactly one
  // organisation, so this identifies that organisation — it is never used to
  // choose between organisations.
  private connectionTenantIds: string[] = [];
  private boundOrganisation: Organisation | undefined;

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

    this.connectionTenantIds = Array.isArray(connectionsResponse.data)
      ? connectionsResponse.data
          .map((connection: { tenantId?: unknown }) => connection?.tenantId)
          .filter(
            (tenantId: unknown): tenantId is string =>
              typeof tenantId === "string" && tenantId.trim().length > 0,
          )
          .map((tenantId: string) => tenantId.trim())
      : [];

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

  /**
   * The organisation this Custom Connection is bound to. The lookup uses the
   * empty tenant ID because the bound organisation may not be known yet; the
   * result is credential-scoped and so safe to cache for the process lifetime.
   */
  public async getBoundOrganisation(): Promise<Organisation> {
    if (!this.boundOrganisation) {
      this.boundOrganisation = await this.getOrganisation("");
    }

    return this.boundOrganisation;
  }

  /**
   * Resolves `requestedTenantId` to the bound organisation's identifier, in the
   * casing Xero reported it, or undefined when it does not identify that
   * organisation.
   */
  public async resolveBoundOrganisationId(
    requestedTenantId: string,
  ): Promise<string | undefined> {
    const requested = requestedTenantId.trim().toLowerCase();

    if (!requested) {
      return undefined;
    }

    // Only trust the /connections result when it named exactly one
    // organisation. More than one contradicts the Custom Connection contract,
    // so fall back to the organisation the credential actually reaches.
    const boundTenantId = this.boundTenantId;

    if (boundTenantId && boundTenantId.toLowerCase() === requested) {
      return boundTenantId;
    }

    const organisationId = (await this.getBoundOrganisation()).organisationID;

    if (
      typeof organisationId === "string" &&
      organisationId.trim().toLowerCase() === requested
    ) {
      return organisationId.trim();
    }

    return undefined;
  }

  /**
   * The bound organisation identifier learned during token acquisition, or the
   * empty string when it could not be established unambiguously. Never used to
   * choose between organisations: a Custom Connection has exactly one.
   */
  public get boundTenantId(): string {
    return this.connectionTenantIds.length === 1
      ? this.connectionTenantIds[0]
      : "";
  }
}

export class BearerTokenXeroClient extends MCPXeroClient {
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

export type XeroAuthMode = "bearer" | "custom-connection";

/**
 * Which credential the server is running with. Derived once, from the same
 * check that picks the client implementation.
 */
export const authMode: XeroAuthMode = bearer_token
  ? "bearer"
  : "custom-connection";

export const isCustomConnectionMode = (): boolean =>
  authMode === "custom-connection";

export const xeroClient: MCPXeroClient = bearer_token
  ? new BearerTokenXeroClient({
      bearerToken: bearer_token,
    })
  : new CustomConnectionsXeroClient({
      clientId: client_id!,
      clientSecret: client_secret!,
      grantType: grant_type,
    });
