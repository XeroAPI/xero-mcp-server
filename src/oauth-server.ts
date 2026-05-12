/**
 * OAuth 2.1 authorization server that chains user authentication through Xero.
 *
 * Wired up to the MCP SDK's `mcpAuthRouter`, which mounts the standard
 * /.well-known, /authorize, /token, /register, and /revoke endpoints.
 * This file provides:
 *  - the `OAuthServerProvider` implementation that knows how to redirect to
 *    Xero on /authorize, capture Xero's callback, store the refresh token in
 *    Secret Manager, and issue our own JWT-based access/refresh tokens.
 *  - the `/callback` Express route that receives Xero's redirect.
 */
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { Request, RequestHandler, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_USERINFO_URL = "https://identity.xero.com/connect/userinfo";

const ISSUER = "xero-mcp-server";
const AUDIENCE = "xero-mcp-server";
const ACCESS_TOKEN_TTL_SEC = 3600;
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 3600;
const CODE_TTL_MS = 60_000;
const STATE_TTL_MS = 10 * 60_000;

const GRANULAR_XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.contacts",
  "accounting.settings",
  "accounting.attachments",
  "accounting.invoices",
  "accounting.payments",
  "accounting.banktransactions",
  "accounting.manualjournals",
  "accounting.reports.profitandloss.read",
  "accounting.reports.balancesheet.read",
  "accounting.reports.trialbalance.read",
].join(" ");

const ALLOWED_CLAUDE_REDIRECTS = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]);

type ClaudePending = {
  claudeClientId: string;
  claudeRedirectUri: string;
  claudeCodeChallenge: string;
  claudeState?: string;
  claudeScopes?: string[];
  createdAt: number;
};

type IssuedCode = {
  clientId: string;
  sub: string;
  name: string;
  codeChallenge: string;
  redirectUri: string;
  scopes?: string[];
  createdAt: number;
};

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function randomTokenString(): string {
  return base64url(randomBytes(32));
}

function isValidSub(sub: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,128}$/.test(sub);
}

function isValidClaudeRedirect(uri: string): boolean {
  return ALLOWED_CLAUDE_REDIRECTS.has(uri);
}

function resolveDisplayName(ui: {
  given_name?: string;
  family_name?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
}): string {
  const composed = [ui.given_name, ui.family_name].filter(Boolean).join(" ").trim();
  return composed || ui.name || ui.preferred_username || ui.email || "Unknown user";
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private readonly store = new Map<string, OAuthClientInformationFull>();

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    const known = this.store.get(clientId);
    if (known) return known;
    // Stateless fallback: Cloud Run scales to zero and wipes this map. When
    // Claude comes back with a client_id from a previous container, we
    // synthesize a client object with the standard Claude callback URLs.
    // Security gate is the redirect_uri allowlist + PKCE + our JWT signature
    // (in exchangeAuthorizationCode / exchangeRefreshToken / verifyAccessToken),
    // not the client_id value itself.
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(clientId)) return undefined;
    return {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: [...ALLOWED_CLAUDE_REDIRECTS],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    };
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): OAuthClientInformationFull {
    const requestedRedirects = client.redirect_uris ?? [];
    if (
      requestedRedirects.length === 0 ||
      !requestedRedirects.every(isValidClaudeRedirect)
    ) {
      throw new Error(
        "redirect_uri must be one of the Claude MCP callback URLs",
      );
    }
    const full: OAuthClientInformationFull = {
      ...client,
      client_id: randomTokenString(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.store.set(full.client_id, full);
    return full;
  }
}

export type XeroOAuthProviderConfig = {
  xeroClientId: string;
  xeroClientSecret: string;
  callbackUrl: string;
  jwtSecret: string;
  projectId: string;
  secretManager: SecretManagerServiceClient;
};

export class XeroChainedOAuthProvider implements OAuthServerProvider {
  public readonly clientsStore: InMemoryClientsStore;
  private readonly pendingState = new Map<string, ClaudePending & { xeroVerifier: string }>();
  private readonly issuedCodes = new Map<string, IssuedCode>();

  constructor(private readonly config: XeroOAuthProviderConfig) {
    this.clientsStore = new InMemoryClientsStore();
    setInterval(() => this.evictExpired(), 60_000).unref();
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    if (!isValidClaudeRedirect(params.redirectUri)) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "redirect_uri not allowlisted",
      });
      return;
    }
    if (
      !client.redirect_uris.some((u) => constantTimeEqual(u, params.redirectUri))
    ) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "redirect_uri not registered for this client",
      });
      return;
    }
    if (!params.codeChallenge) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "code_challenge required (PKCE S256)",
      });
      return;
    }

    const xeroVerifier = base64url(randomBytes(32));
    const xeroChallenge = base64url(
      createHash("sha256").update(xeroVerifier).digest(),
    );
    const state = randomTokenString();

    this.pendingState.set(state, {
      claudeClientId: client.client_id,
      claudeRedirectUri: params.redirectUri,
      claudeCodeChallenge: params.codeChallenge,
      claudeState: params.state,
      claudeScopes: params.scopes,
      xeroVerifier,
      createdAt: Date.now(),
    });

    const xeroUrl = new URL(XERO_AUTHORIZE_URL);
    xeroUrl.searchParams.set("response_type", "code");
    xeroUrl.searchParams.set("client_id", this.config.xeroClientId);
    xeroUrl.searchParams.set("redirect_uri", this.config.callbackUrl);
    xeroUrl.searchParams.set("scope", GRANULAR_XERO_SCOPES);
    xeroUrl.searchParams.set("state", state);
    xeroUrl.searchParams.set("code_challenge", xeroChallenge);
    xeroUrl.searchParams.set("code_challenge_method", "S256");

    res.redirect(xeroUrl.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const issued = this.issuedCodes.get(authorizationCode);
    if (!issued) throw new Error("invalid_grant");
    return issued.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    const issued = this.issuedCodes.get(authorizationCode);
    if (!issued) throw new Error("invalid_grant");
    // Delete first so any concurrent re-use lands on the !issued branch and is
    // rejected, instead of relying on a `consumed` flag that lives in the map.
    this.issuedCodes.delete(authorizationCode);
    if (Date.now() - issued.createdAt > CODE_TTL_MS) {
      throw new Error("invalid_grant");
    }
    if (!constantTimeEqual(issued.clientId, client.client_id)) {
      throw new Error("invalid_grant");
    }
    if (redirectUri && !constantTimeEqual(issued.redirectUri, redirectUri)) {
      throw new Error("invalid_grant");
    }

    return this.issueTokens(client.client_id, issued.sub, issued.name);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, this.config.jwtSecret, {
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as jwt.JwtPayload;
    } catch {
      throw new Error("invalid_grant");
    }
    if (payload.typ !== "refresh") throw new Error("invalid_grant");
    if (typeof payload.sub !== "string" || !isValidSub(payload.sub)) {
      throw new Error("invalid_grant");
    }
    const name = typeof payload.name === "string" ? payload.name : "Unknown user";
    return this.issueTokens(client.client_id, payload.sub, name);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.config.jwtSecret, {
        issuer: ISSUER,
        audience: AUDIENCE,
      }) as jwt.JwtPayload;
    } catch (e) {
      const msg = (e as Error).message ?? "verify failed";
      console.error("[oauth] verifyAccessToken: jwt.verify rejected:", msg);
      throw new InvalidTokenError(`Invalid bearer token: ${msg}`);
    }
    if (payload.typ !== "access") {
      console.error("[oauth] verifyAccessToken: wrong typ:", payload.typ);
      throw new InvalidTokenError("Wrong token type (expected access)");
    }
    if (typeof payload.sub !== "string" || !isValidSub(payload.sub)) {
      console.error("[oauth] verifyAccessToken: bad sub:", payload.sub);
      throw new InvalidTokenError("Token sub is missing or malformed");
    }
    if (typeof payload.exp !== "number") {
      console.error("[oauth] verifyAccessToken: missing exp claim");
      throw new InvalidTokenError("Token has no exp claim");
    }
    return {
      token,
      clientId: typeof payload.client_id === "string" ? payload.client_id : "",
      scopes: [],
      expiresAt: payload.exp,
      extra: {
        sub: payload.sub,
        name: typeof payload.name === "string" ? payload.name : "Unknown user",
      },
    };
  }

  /**
   * Called by the `/callback` route after Xero redirects the user back.
   * Exchanges Xero's code for tokens, identifies the user via userinfo,
   * persists the refresh token in Secret Manager, mints our auth code,
   * and returns the URL we should redirect the user to (Claude's redirect).
   */
  async handleXeroCallback(
    state: string,
    code: string | undefined,
    errorParam?: string,
  ): Promise<string> {
    const pending = this.pendingState.get(state);
    if (!pending) throw new Error("Unknown state");
    this.pendingState.delete(state);
    if (Date.now() - pending.createdAt > STATE_TTL_MS) {
      throw new Error("Expired state");
    }

    if (errorParam) {
      const url = new URL(pending.claudeRedirectUri);
      url.searchParams.set("error", errorParam);
      if (pending.claudeState) url.searchParams.set("state", pending.claudeState);
      return url.toString();
    }
    if (!code) throw new Error("Missing code from Xero");

    // Exchange Xero code for tokens
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.callbackUrl,
      code_verifier: pending.xeroVerifier,
    });
    const basicCreds = Buffer.from(
      `${this.config.xeroClientId}:${this.config.xeroClientSecret}`,
    ).toString("base64");
    const tokenResp = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicCreds}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      throw new Error(`Xero token exchange failed (${tokenResp.status}): ${text}`);
    }
    const tokens = (await tokenResp.json()) as {
      access_token: string;
      refresh_token: string;
    };
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Xero token response missing access_token or refresh_token");
    }

    // Resolve the user identity (xero_userid is the stable per-user UUID)
    const uiResp = await fetch(XERO_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!uiResp.ok) throw new Error("Xero /connect/userinfo failed");
    const userinfo = (await uiResp.json()) as {
      xero_userid?: string;
      sub?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
      preferred_username?: string;
      email?: string;
    };
    const sub = userinfo.xero_userid ?? userinfo.sub;
    if (!sub || !isValidSub(sub)) {
      throw new Error("Xero userinfo did not return a valid xero_userid/sub");
    }
    const name = resolveDisplayName(userinfo);

    await this.persistXeroRefreshToken(sub, tokens.refresh_token);

    // Mint our auth code for Claude
    const ourCode = randomTokenString();
    this.issuedCodes.set(ourCode, {
      clientId: pending.claudeClientId,
      sub,
      name,
      codeChallenge: pending.claudeCodeChallenge,
      redirectUri: pending.claudeRedirectUri,
      scopes: pending.claudeScopes,
      createdAt: Date.now(),
    });

    const redirect = new URL(pending.claudeRedirectUri);
    redirect.searchParams.set("code", ourCode);
    if (pending.claudeState) redirect.searchParams.set("state", pending.claudeState);
    return redirect.toString();
  }

  private async persistXeroRefreshToken(
    sub: string,
    refreshToken: string,
  ): Promise<void> {
    const secretId = `xero-refresh-token-${sub}`;
    const parent = `projects/${this.config.projectId}`;
    const secretName = `${parent}/secrets/${secretId}`;
    try {
      await this.config.secretManager.createSecret({
        parent,
        secretId,
        secret: { replication: { automatic: {} } },
      });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (!/already exists/i.test(msg) && !/6 ALREADY_EXISTS/.test(msg)) {
        throw e;
      }
    }
    await this.config.secretManager.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(refreshToken, "utf8") },
    });
  }

  private issueTokens(
    clientId: string,
    sub: string,
    name: string,
  ): OAuthTokens {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = jwt.sign(
      {
        sub,
        name,
        typ: "access",
        client_id: clientId,
        iat: now,
        exp: now + ACCESS_TOKEN_TTL_SEC,
      },
      this.config.jwtSecret,
      { algorithm: "HS256", issuer: ISSUER, audience: AUDIENCE },
    );
    const refreshToken = jwt.sign(
      {
        sub,
        name,
        typ: "refresh",
        client_id: clientId,
        iat: now,
        exp: now + REFRESH_TOKEN_TTL_SEC,
      },
      this.config.jwtSecret,
      { algorithm: "HS256", issuer: ISSUER, audience: AUDIENCE },
    );
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SEC,
      refresh_token: refreshToken,
      scope: "",
    };
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.issuedCodes) {
      if (now - v.createdAt > CODE_TTL_MS) this.issuedCodes.delete(k);
    }
    for (const [k, v] of this.pendingState) {
      if (now - v.createdAt > STATE_TTL_MS) this.pendingState.delete(k);
    }
  }
}

export function createXeroCallbackRouter(
  provider: XeroChainedOAuthProvider,
): Router {
  const router = Router();
  router.get("/callback", async (req: Request, res: Response) => {
    const stateRaw = req.query.state;
    const codeRaw = req.query.code;
    const errorRaw = req.query.error;
    if (typeof stateRaw !== "string") {
      res.status(400).send("Missing state");
      return;
    }
    try {
      const redirect = await provider.handleXeroCallback(
        stateRaw,
        typeof codeRaw === "string" ? codeRaw : undefined,
        typeof errorRaw === "string" ? errorRaw : undefined,
      );
      res.redirect(redirect);
    } catch (e) {
      const msg = (e as Error).message ?? "callback failed";
      res.status(400).json({
        error: "invalid_request",
        error_description: msg,
      });
    }
  });
  return router;
}

export function buildMcpAuthRouter(
  provider: XeroChainedOAuthProvider,
  issuerUrl: URL,
  resourceServerUrl: URL,
): RequestHandler {
  return mcpAuthRouter({
    provider,
    issuerUrl,
    resourceServerUrl,
    scopesSupported: ["xero"],
  });
}
