import fs from "fs";

/**
 * Shape of the OAuth2 token store on disk. It is the raw token response from
 * Xero's identity endpoint with two added bookkeeping fields:
 * - `_obtained_at`: epoch seconds when the token was minted/refreshed.
 * - `expires_at`: epoch seconds when the access token expires.
 *
 * Both the bootstrap flow (authorization-code) and the running server's
 * RefreshingTokenXeroClient (refresh-token) read and write this exact shape, so
 * the two cannot drift.
 */
export interface TokenStore {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  _obtained_at?: number;
  expires_at?: number;
  // Tolerate any extra fields Xero returns without losing them on re-persist.
  [key: string]: unknown;
}

/** Read and parse the token store. Throws if the file is missing or malformed. */
export function readTokens(path: string): TokenStore {
  return JSON.parse(fs.readFileSync(path, "utf-8")) as TokenStore;
}

/**
 * Write the token store atomically with 0600 perms: write a sibling `.tmp` file
 * then rename over the target, so a crash mid-write can never leave a truncated
 * token file (and the refresh token inside is never world-readable).
 */
export function persistTokens(path: string, tok: TokenStore): void {
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(tok, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, path);
}

/**
 * Stamp `_obtained_at`/`expires_at` onto a fresh token response (mutates and
 * returns it). `expires_in` defaults to 1800s (30 min) when Xero omits it.
 */
export function stampExpiry(tok: TokenStore): TokenStore {
  const now = Math.floor(Date.now() / 1000);
  tok._obtained_at = now;
  tok.expires_at = now + (tok.expires_in ?? 1800);
  return tok;
}
