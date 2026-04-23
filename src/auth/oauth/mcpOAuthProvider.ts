import type { Request, RequestHandler, Response } from "express";

import {
  AccessDeniedError,
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidScopeError,
  InvalidTargetError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

import type { AppConfig } from "../../lib/config.js";
import { HttpAuthError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import {
  GoogleIdentityService,
  type GoogleIdentity,
} from "./googleIdentity.js";
import { SignedTokenService } from "./signedTokens.js";

export const GOOGLE_CALLBACK_PATH = "/oauth/google/callback";

interface StatelessClientRecord {
  client_id: string;
  client_id_issued_at: number;
  redirect_uris: string[];
  token_endpoint_auth_method: "none" | "client_secret_post";
  grant_types: string[];
  response_types: string[];
  client_secret_expires_at?: number;
  scope?: string;
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  software_id?: string;
  software_version?: string;
}

interface AuthorizationStateRecord {
  nonce: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  oauthState?: string;
  resource?: string;
}

interface AuthorizationCodeRecord {
  subject: string;
  email: string;
  hostedDomain?: string;
  name?: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource?: string;
}

interface RefreshTokenRecord {
  subject: string;
  email: string;
  hostedDomain?: string;
  name?: string;
  clientId: string;
  scopes: string[];
  resource?: string;
}

type AccessTokenRecord = RefreshTokenRecord;

class StatelessOAuthClientsStore implements OAuthRegisteredClientsStore {
  constructor(
    private readonly tokenService: SignedTokenService,
    private readonly logger: Logger,
  ) {}

  async getClient(
    clientId: string,
  ): Promise<OAuthClientInformationFull | undefined> {
    try {
      const verified = this.tokenService.verify<StatelessClientRecord>(
        clientId,
        "oauth_client",
      );
      const clientSecret =
        verified.data.token_endpoint_auth_method === "client_secret_post"
          ? this.deriveClientSecret(clientId)
          : undefined;
      return {
        ...verified.data,
        client_id: clientId,
        client_secret: clientSecret,
      };
    } catch (error) {
      this.logger.warn("oauth_client_lookup_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): Promise<OAuthClientInformationFull> {
    const requestedMethod = client.token_endpoint_auth_method ?? "none";
    const isPublicClient = requestedMethod === "none";
    if (
      !isPublicClient &&
      !["client_secret_post", "client_secret_basic"].includes(requestedMethod)
    ) {
      throw new InvalidClientMetadataError(
        "Only token_endpoint_auth_method values of none, client_secret_post, or client_secret_basic are supported.",
      );
    }

    const grantTypes = client.grant_types ?? [
      "authorization_code",
      "refresh_token",
    ];
    const responseTypes = client.response_types ?? ["code"];
    const invalidGrant = grantTypes.some(
      (grantType) =>
        !["authorization_code", "refresh_token"].includes(grantType),
    );
    if (invalidGrant) {
      throw new InvalidClientMetadataError(
        "Only authorization_code and refresh_token grant types are supported.",
      );
    }

    if (responseTypes.length !== 1 || responseTypes[0] !== "code") {
      throw new InvalidClientMetadataError(
        'Only the response type "code" is supported.',
      );
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const record: StatelessClientRecord = {
      client_id: "",
      client_id_issued_at: issuedAt,
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: isPublicClient
        ? "none"
        : "client_secret_post",
      grant_types: grantTypes,
      response_types: responseTypes,
      client_secret_expires_at: isPublicClient
        ? undefined
        : client.client_secret_expires_at,
      scope: client.scope,
      client_name: client.client_name,
      client_uri: client.client_uri,
      logo_uri: client.logo_uri,
      contacts: client.contacts,
      tos_uri: client.tos_uri,
      policy_uri: client.policy_uri,
      software_id: client.software_id,
      software_version: client.software_version,
    };

    const clientId = this.tokenService.sign(
      "oauth_client",
      record,
      60 * 60 * 24 * 365 * 10,
      issuedAt,
    );
    const fullRecord: StatelessClientRecord = {
      ...record,
      client_id: clientId,
    };

    return {
      ...fullRecord,
      client_secret: isPublicClient
        ? undefined
        : this.deriveClientSecret(clientId),
    };
  }

  private deriveClientSecret(clientId: string): string {
    return this.tokenService.deriveDeterministicSecret(
      "oauth_client_secret",
      clientId,
    );
  }
}

export class GoogleBackedMcpOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: OAuthRegisteredClientsStore;

  private readonly tokenService: SignedTokenService;
  private readonly googleIdentityService: GoogleIdentityService;
  private readonly supportedScopeSet: Set<string>;
  private readonly resourceServerUrl: string;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {
    if (
      !config.oauth.signingSecret ||
      !config.oauth.publicBaseUrl ||
      !config.oauth.googleClientId ||
      !config.oauth.googleClientSecret
    ) {
      throw new HttpAuthError("OAuth provider is missing required configuration.");
    }

    this.tokenService = new SignedTokenService(config.oauth.signingSecret);
    this.clientsStore = new StatelessOAuthClientsStore(
      this.tokenService,
      logger.child({ component: "oauth_clients" }),
    );
    this.supportedScopeSet = new Set(config.oauth.supportedScopes);
    this.resourceServerUrl = new URL(
      config.http.path,
      `${config.oauth.publicBaseUrl}/`,
    ).toString();
    this.googleIdentityService = new GoogleIdentityService(
      {
        clientId: config.oauth.googleClientId,
        clientSecret: config.oauth.googleClientSecret,
        redirectUri: new URL(
          GOOGLE_CALLBACK_PATH,
          `${config.oauth.publicBaseUrl}/`,
        ).toString(),
        hostedDomain: config.oauth.googleHostedDomain,
        allowedEmailDomain: config.oauth.googleAllowedEmailDomain ?? "",
      },
      logger.child({ component: "google_oauth" }),
    );
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const scopes = this.resolveScopes(params.scopes);
    const resource = this.resolveResource(params.resource);
    const nonce = this.googleIdentityService.createNonce();
    const stateToken = this.tokenService.sign<AuthorizationStateRecord>(
      "google_auth_state",
      {
        nonce,
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        scopes,
        oauthState: params.state,
        resource,
      },
      this.config.oauth.authCodeTtlSeconds,
    );

    const googleAuthorizeUrl =
      await this.googleIdentityService.buildAuthorizationUrl(stateToken, nonce);
    this.logger.info("oauth_authorization_started", {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
    });
    res.redirect(302, googleAuthorizeUrl);
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const verified = this.tokenService.verify<AuthorizationCodeRecord>(
      authorizationCode,
      "authorization_code",
    );
    if (verified.data.clientId !== client.client_id) {
      throw new InvalidGrantError(
        "Authorization code was issued to another client.",
      );
    }

    return verified.data.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const verified = this.tokenService.verify<AuthorizationCodeRecord>(
      authorizationCode,
      "authorization_code",
    );
    const data = verified.data;

    if (data.clientId !== client.client_id) {
      throw new InvalidGrantError(
        "Authorization code was issued to another client.",
      );
    }

    if (redirectUri && redirectUri !== data.redirectUri) {
      throw new InvalidGrantError(
        "redirect_uri does not match the authorization request.",
      );
    }

    const resolvedResource = this.resolveResource(resource, data.resource);
    return this.issueTokens(data, resolvedResource);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const verified = this.tokenService.verify<RefreshTokenRecord>(
      refreshToken,
      "refresh_token",
    );
    const data = verified.data;

    if (data.clientId !== client.client_id) {
      throw new InvalidGrantError(
        "Refresh token was issued to another client.",
      );
    }

    const grantedScopes = new Set(data.scopes);
    const resolvedScopes = scopes && scopes.length > 0 ? scopes : data.scopes;
    for (const scope of resolvedScopes) {
      if (!grantedScopes.has(scope)) {
        throw new InvalidScopeError(
          `Scope "${scope}" was not granted to this refresh token.`,
        );
      }
    }

    const resolvedResource = this.resolveResource(resource, data.resource);
    return this.issueTokens(
      {
        subject: data.subject,
        email: data.email,
        hostedDomain: data.hostedDomain,
        name: data.name,
        clientId: data.clientId,
        redirectUri: "",
        codeChallenge: "",
        scopes: resolvedScopes,
        resource: resolvedResource,
      },
      resolvedResource,
      refreshToken,
    );
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const verified = this.tokenService.verify<AccessTokenRecord>(
      token,
      "access_token",
    );
    const data = verified.data;
    const resource = this.resolveResource(data.resource);

    return {
      token,
      clientId: data.clientId,
      scopes: data.scopes,
      expiresAt: verified.exp,
      resource: resource ? new URL(resource) : undefined,
      extra: {
        email: data.email,
        hostedDomain: data.hostedDomain,
        name: data.name,
      },
    };
  }

  revokeToken?(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    void client;
    void request;
    return Promise.resolve();
  }

  createGoogleCallbackHandler(): RequestHandler {
    return async (request: Request, response: Response) => {
      response.setHeader("Cache-Control", "no-store");

      const code =
        typeof request.query.code === "string" ? request.query.code : undefined;
      const state =
        typeof request.query.state === "string" ? request.query.state : undefined;
      const oauthError =
        typeof request.query.error === "string"
          ? request.query.error
          : undefined;

      if (oauthError) {
        this.logger.warn("google_oauth_denied", {
          error: oauthError,
        });
        response.status(403).send("Google sign-in was denied.");
        return;
      }

      if (!code || !state) {
        response
          .status(400)
          .send("Missing required Google OAuth callback parameters.");
        return;
      }

      try {
        const verifiedState = this.tokenService.verify<AuthorizationStateRecord>(
          state,
          "google_auth_state",
        );
        const identity = await this.googleIdentityService.exchangeCode(
          code,
          verifiedState.data.nonce,
        );
        const authorizationCode = this.issueAuthorizationCode(
          verifiedState.data,
          identity,
        );
        const redirectUrl = new URL(verifiedState.data.redirectUri);
        redirectUrl.searchParams.set("code", authorizationCode);
        if (verifiedState.data.oauthState) {
          redirectUrl.searchParams.set("state", verifiedState.data.oauthState);
        }

        this.logger.info("oauth_authorization_completed", {
          email: identity.email,
          clientId: verifiedState.data.clientId,
        });
        response.redirect(302, redirectUrl.toString());
      } catch (error) {
        this.logger.warn("google_oauth_callback_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        const message =
          error instanceof AccessDeniedError
            ? error.message
            : "Google sign-in failed.";
        response.status(403).send(message);
      }
    };
  }

  getIssuerUrl(): string {
    return this.config.oauth.issuerUrl ?? this.config.oauth.publicBaseUrl ?? "";
  }

  getSupportedScopes(): string[] {
    return [...this.supportedScopeSet];
  }

  private issueAuthorizationCode(
    state: AuthorizationStateRecord,
    identity: GoogleIdentity,
  ): string {
    return this.tokenService.sign<AuthorizationCodeRecord>(
      "authorization_code",
      {
        subject: identity.subject,
        email: identity.email,
        hostedDomain: identity.hostedDomain,
        name: identity.name,
        clientId: state.clientId,
        redirectUri: state.redirectUri,
        codeChallenge: state.codeChallenge,
        scopes: state.scopes,
        resource: state.resource,
      },
      this.config.oauth.authCodeTtlSeconds,
    );
  }

  private issueTokens(
    data: AuthorizationCodeRecord,
    resource: string,
    refreshTokenOverride?: string,
  ): OAuthTokens {
    const accessPayload: AccessTokenRecord = {
      subject: data.subject,
      email: data.email,
      hostedDomain: data.hostedDomain,
      name: data.name,
      clientId: data.clientId,
      scopes: data.scopes,
      resource,
    };
    const refreshPayload: RefreshTokenRecord = {
      subject: data.subject,
      email: data.email,
      hostedDomain: data.hostedDomain,
      name: data.name,
      clientId: data.clientId,
      scopes: data.scopes,
      resource,
    };

    return {
      access_token: this.tokenService.sign(
        "access_token",
        accessPayload,
        this.config.oauth.accessTokenTtlSeconds,
      ),
      token_type: "Bearer",
      expires_in: this.config.oauth.accessTokenTtlSeconds,
      scope: data.scopes.join(" "),
      refresh_token:
        refreshTokenOverride ??
        this.tokenService.sign(
          "refresh_token",
          refreshPayload,
          this.config.oauth.refreshTokenTtlSeconds,
        ),
    };
  }

  private resolveScopes(requestedScopes: string[] | undefined): string[] {
    if (!requestedScopes || requestedScopes.length === 0) {
      return [...this.supportedScopeSet];
    }

    for (const scope of requestedScopes) {
      if (!this.supportedScopeSet.has(scope)) {
        throw new InvalidScopeError(`Unsupported scope "${scope}".`);
      }
    }

    return requestedScopes;
  }

  private resolveResource(resource?: URL | string, fallback?: string): string {
    const candidate =
      typeof resource === "string"
        ? resource
        : resource?.toString() ?? fallback ?? this.resourceServerUrl;
    if (candidate !== this.resourceServerUrl) {
      throw new InvalidTargetError(`Unsupported resource "${candidate}".`);
    }

    return candidate;
  }
}
