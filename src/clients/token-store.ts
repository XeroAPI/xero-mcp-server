import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { TokenSetParameters } from "xero-node";

// A persisted tokenset is a standard OAuth TokenSet plus the tenant we resolved
// at consent time, so the MCP server can attach the correct org on every call
// without an extra round-trip.
export interface PersistedTokenSet extends TokenSetParameters {
  tenantId?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve where the tokenset JSON lives. Override with XERO_TOKENSET_PATH;
 * otherwise default to the repo root (two levels up from src/clients/dist).
 */
export function getTokenPath(): string {
  if (process.env.XERO_TOKENSET_PATH) {
    return path.resolve(process.env.XERO_TOKENSET_PATH);
  }
  // dist/clients/token-store.js -> repo root
  return path.resolve(__dirname, "..", "..", ".xero-tokenset.json");
}

export function loadTokenSet(): PersistedTokenSet | null {
  const file = getTokenPath();
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as PersistedTokenSet;
  } catch {
    return null;
  }
}

export function saveTokenSet(tokenSet: PersistedTokenSet): void {
  const file = getTokenPath();
  fs.writeFileSync(file, JSON.stringify(tokenSet, null, 2), { mode: 0o600 });
  // Tighten perms even if the file already existed with looser ones.
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // best-effort (e.g. unsupported FS)
  }
}

export function clearTokenSet(): void {
  const file = getTokenPath();
  try {
    fs.unlinkSync(file);
  } catch {
    // best-effort
  }
}
