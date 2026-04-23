import { createHmac, timingSafeEqual } from "node:crypto";

import { HttpAuthError } from "../../lib/errors.js";

interface SignedEnvelope<T> {
  v: 1;
  typ: string;
  iat: number;
  exp: number;
  data: T;
}

export interface VerifiedEnvelope<T> extends SignedEnvelope<T> {
  token: string;
}

const TOKEN_PREFIX = "mcp1";

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export class SignedTokenService {
  constructor(private readonly secret: string) {}

  sign<T>(
    type: string,
    data: T,
    ttlSeconds: number,
    now = Math.floor(Date.now() / 1000),
  ): string {
    const envelope: SignedEnvelope<T> = {
      v: 1,
      typ: type,
      iat: now,
      exp: now + ttlSeconds,
      data,
    };

    const payload = encodeBase64Url(JSON.stringify(envelope));
    const signature = this.signPayload(payload);
    return `${TOKEN_PREFIX}.${payload}.${signature}`;
  }

  verify<T>(
    token: string,
    expectedType: string,
    now = Math.floor(Date.now() / 1000),
  ): VerifiedEnvelope<T> {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
      throw new HttpAuthError("Malformed signed token.");
    }

    const [, payload, signature] = parts;
    if (!payload || !signature) {
      throw new HttpAuthError("Malformed signed token.");
    }

    const expectedSignature = this.signPayload(payload);
    const providedBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new HttpAuthError("Invalid signed token signature.");
    }

    let parsed: SignedEnvelope<T>;
    try {
      parsed = JSON.parse(decodeBase64Url(payload)) as SignedEnvelope<T>;
    } catch {
      throw new HttpAuthError("Invalid signed token payload.");
    }

    if (parsed.v !== 1 || parsed.typ !== expectedType) {
      throw new HttpAuthError("Unexpected signed token type.");
    }

    if (!Number.isFinite(parsed.exp) || parsed.exp < now) {
      throw new HttpAuthError("Signed token has expired.");
    }

    return {
      ...parsed,
      token,
    };
  }

  private signPayload(payload: string): string {
    return createHmac("sha256", this.secret)
      .update(payload)
      .digest("base64url");
  }

  deriveDeterministicSecret(namespace: string, value: string): string {
    return createHmac("sha256", this.secret)
      .update(`${namespace}:${value}`)
      .digest("base64url");
  }
}
