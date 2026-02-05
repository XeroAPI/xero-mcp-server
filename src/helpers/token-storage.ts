import fs from "fs";
import path from "path";
import { TokenSet } from "xero-node";

const TOKEN_FILE = process.env.XERO_TOKEN_FILE || path.join(process.cwd(), ".xero-tokens.json");

export interface StoredTokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in milliseconds
  token_type?: string;
  scope?: string;
}

export function saveTokens(tokens: StoredTokenSet): void {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export function loadTokens(): StoredTokenSet | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, "utf-8");
      return JSON.parse(data) as StoredTokenSet;
    }
  } catch (error) {
    console.error("Failed to load tokens:", error);
  }
  return null;
}

export function isTokenExpired(tokens: StoredTokenSet): boolean {
  // Consider token expired 60 seconds before actual expiry for safety margin
  const safetyMargin = 60 * 1000;
  return Date.now() >= tokens.expires_at - safetyMargin;
}

export function tokenSetToStored(tokenSet: TokenSet, expiresIn: number): StoredTokenSet {
  return {
    access_token: tokenSet.access_token!,
    refresh_token: tokenSet.refresh_token!,
    expires_at: Date.now() + expiresIn * 1000,
    token_type: tokenSet.token_type,
    scope: tokenSet.scope,
  };
}
