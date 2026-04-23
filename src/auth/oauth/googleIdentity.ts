import { randomUUID } from "node:crypto";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { HttpAuthError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";

interface GoogleDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleIdentityClaims extends JWTPayload {
  email?: string;
  email_verified?: boolean;
  hd?: string;
  name?: string;
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  hostedDomain?: string;
  name?: string;
}

export class GoogleIdentityService {
  private discoveryCache?: GoogleDiscoveryDocument;
  private discoveryExpiresAt = 0;

  constructor(
    private readonly options: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      hostedDomain?: string;
      allowedEmailDomain: string;
    },
    private readonly logger: Logger,
  ) {}

  async buildAuthorizationUrl(state: string, nonce: string): Promise<string> {
    const discovery = await this.getDiscovery();
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set("client_id", this.options.clientId);
    url.searchParams.set("redirect_uri", this.options.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("prompt", "select_account");

    if (this.options.hostedDomain) {
      url.searchParams.set("hd", this.options.hostedDomain);
    }

    return url.toString();
  }

  async exchangeCode(code: string, expectedNonce: string): Promise<GoogleIdentity> {
    const discovery = await this.getDiscovery();
    const body = new URLSearchParams({
      code,
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      redirect_uri: this.options.redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const details = await response.text();
      this.logger.warn("google_oauth_exchange_failed", {
        status: response.status,
        details,
      });
      throw new HttpAuthError("Google sign-in failed during token exchange.");
    }

    const tokens = (await response.json()) as GoogleTokenResponse;
    if (!tokens.id_token) {
      throw new HttpAuthError("Google sign-in did not return an ID token.");
    }

    const keySet = createRemoteJWKSet(new URL(discovery.jwks_uri));
    const verification = await jwtVerify(tokens.id_token, keySet, {
      audience: this.options.clientId,
      issuer: [discovery.issuer, "accounts.google.com"],
    });

    const claims = verification.payload as GoogleIdentityClaims;
    if (claims.nonce !== expectedNonce) {
      throw new HttpAuthError("Google sign-in returned an unexpected nonce.");
    }

    if (claims.email_verified !== true || !claims.email) {
      throw new HttpAuthError(
        "Google sign-in did not return a verified email address.",
      );
    }

    const emailDomain = claims.email.split("@")[1]?.toLowerCase();
    const allowedDomain = this.options.allowedEmailDomain.toLowerCase();
    if (!emailDomain || emailDomain !== allowedDomain) {
      throw new HttpAuthError(
        `Google sign-in is restricted to ${this.options.allowedEmailDomain} users.`,
      );
    }

    if (!claims.sub) {
      throw new HttpAuthError(
        "Google sign-in did not return a subject identifier.",
      );
    }

    return {
      subject: claims.sub,
      email: claims.email,
      hostedDomain: claims.hd,
      name: claims.name,
    };
  }

  createNonce(): string {
    return randomUUID();
  }

  getRedirectUri(): string {
    return this.options.redirectUri;
  }

  private async getDiscovery(): Promise<GoogleDiscoveryDocument> {
    const now = Date.now();
    if (this.discoveryCache && now < this.discoveryExpiresAt) {
      return this.discoveryCache;
    }

    const discoveryUrl =
      "https://accounts.google.com/.well-known/openid-configuration";
    const response = await fetch(discoveryUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      const details = await response.text();
      this.logger.warn("google_discovery_failed", {
        status: response.status,
        details,
      });
      throw new HttpAuthError("Unable to load Google OpenID configuration.");
    }

    const document = (await response.json()) as GoogleDiscoveryDocument;
    this.discoveryCache = document;
    this.discoveryExpiresAt = now + 60 * 60 * 1000;
    return document;
  }
}
