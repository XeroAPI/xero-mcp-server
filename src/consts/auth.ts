// OAuth2 authorization-code flow endpoints. The authorize URL lives on
// login.xero.com; token exchange and refresh share identity.xero.com.
export const XERO_AUTHORIZE_URL =
  "https://login.xero.com/identity/connect/authorize";
export const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
export const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

// Loopback redirect the local callback server listens on. Override with
// XERO_REDIRECT_URI; this exact value must be registered in the Xero app's
// allowed Redirect URIs at developer.xero.com. Port 5000 is deliberately avoided
// — macOS Monterey+ runs the AirPlay Receiver there (EADDRINUSE).
export const DEFAULT_REDIRECT_URI = "http://localhost:53682/callback";

/**
 * Resolve the scopes to request during the bootstrap flow.
 *
 * Scopes come exclusively from the `XERO_SCOPES` env var — the same var the
 * running server honours — so the minted token carries exactly what the server
 * will use. There is deliberately no built-in default list: requiring scopes to
 * be set explicitly avoids silently over- or under-granting from a drifting
 * hardcoded default.
 *
 * `offline_access` is appended automatically when absent — it is what yields the
 * refresh token the self-refreshing client depends on; without it there is
 * nothing to refresh.
 */
export function resolveScopes(): string {
  const raw = (process.env.XERO_SCOPES ?? "").trim();
  if (!raw) {
    throw new Error(
      "XERO_SCOPES must be set to a space-separated list of scopes to run the " +
        "auth flow (e.g. \"accounting.transactions accounting.contacts\"). " +
        "offline_access is added automatically.",
    );
  }

  const scopes = raw.split(/\s+/);
  if (!scopes.includes("offline_access")) {
    scopes.push("offline_access");
  }
  return scopes.join(" ");
}
