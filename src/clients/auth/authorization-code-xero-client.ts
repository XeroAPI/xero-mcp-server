import { AxiosError } from "axios";

import { ensureError } from "../../helpers/ensure-error.js";
import { MCPXeroClient } from "./mcp-xero-client.js";

const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 60;

type SecretManagerClient = {
  accessSecretVersion: (req: { name: string }) => Promise<
    [{ payload?: { data?: Buffer | Uint8Array | string | null } }]
  >;
  addSecretVersion: (req: {
    parent: string;
    payload: { data: Buffer };
  }) => Promise<[{ name?: string | null }]>;
  listSecretVersions: (req: { parent: string }) => Promise<
    [Array<{ name?: string | null; state?: string | number | null }>]
  >;
  disableSecretVersion: (req: { name: string }) => Promise<unknown>;
};

export class AuthorizationCodeXeroClient extends MCPXeroClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly secretName: string;
  private secretClient: SecretManagerClient | null = null;
  private currentRefreshToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private latestVersionName: string | null = null;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    secretName: string;
  }) {
    super({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      grantType: "authorization_code",
    });
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.secretName = config.secretName;
  }

  public async authenticate(): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      this.tenantId &&
      this.accessTokenExpiresAt > nowSec + ACCESS_TOKEN_REFRESH_BUFFER_SECONDS
    ) {
      return;
    }

    if (!this.currentRefreshToken) {
      this.currentRefreshToken = await this.readLatestRefreshToken();
    }

    let tokenSet;
    try {
      tokenSet = await this.refreshWithRefreshToken(
        this.clientId,
        this.clientSecret,
        this.currentRefreshToken,
      );
    } catch (error) {
      const err = ensureError(error);
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data;
      const detail =
        typeof responseData === "string"
          ? responseData
          : responseData
            ? JSON.stringify(responseData)
            : err.message;

      if (
        axiosError.response?.status === 400 ||
        /invalid_grant/.test(detail)
      ) {
        throw new Error(
          `Xero refused the stored refresh token. Re-run the bootstrap script (bin/xero-oauth-bootstrap.ts) for this user. Underlying: ${detail}`,
        );
      }
      throw new Error(`Failed to refresh Xero access token: ${detail}`);
    }

    if (
      tokenSet.refresh_token &&
      tokenSet.refresh_token !== this.currentRefreshToken
    ) {
      await this.persistRefreshToken(tokenSet.refresh_token);
      this.currentRefreshToken = tokenSet.refresh_token;
    }

    this.accessTokenExpiresAt =
      tokenSet.expires_at ?? nowSec + (tokenSet.expires_in ?? 1800);

    if (!this.tenantId) {
      await this.updateTenants(false);
    }
  }

  private async getSecretClient(): Promise<SecretManagerClient> {
    if (!this.secretClient) {
      const mod = await import("@google-cloud/secret-manager");
      const ClientCtor = mod.SecretManagerServiceClient;
      this.secretClient = new ClientCtor() as unknown as SecretManagerClient;
    }
    return this.secretClient;
  }

  private async readLatestRefreshToken(): Promise<string> {
    const client = await this.getSecretClient();
    const [version] = await client.accessSecretVersion({
      name: `${this.secretName}/versions/latest`,
    });
    const data = version.payload?.data;
    if (!data) {
      throw new Error(
        `Secret ${this.secretName} has no payload. Run the bootstrap script for this user.`,
      );
    }
    const token =
      typeof data === "string"
        ? data
        : Buffer.from(data as Uint8Array).toString("utf8");
    return token.trim();
  }

  private async persistRefreshToken(newToken: string): Promise<void> {
    const client = await this.getSecretClient();
    const [created] = await client.addSecretVersion({
      parent: this.secretName,
      payload: { data: Buffer.from(newToken, "utf8") },
    });
    this.latestVersionName = created.name ?? null;

    void this.disableOldVersions().catch(() => {
      // best effort — old refresh tokens are already dead with Xero,
      // so leaving them enabled in Secret Manager is a cosmetic issue only.
    });
  }

  private async disableOldVersions(): Promise<void> {
    if (!this.latestVersionName) return;
    const client = await this.getSecretClient();
    const [versions] = await client.listSecretVersions({
      parent: this.secretName,
    });
    for (const v of versions) {
      if (!v.name || v.name === this.latestVersionName) continue;
      const stateLabel =
        typeof v.state === "string" ? v.state : String(v.state ?? "");
      if (stateLabel === "ENABLED" || stateLabel === "1" || v.state === 1) {
        await client.disableSecretVersion({ name: v.name });
      }
    }
  }
}
