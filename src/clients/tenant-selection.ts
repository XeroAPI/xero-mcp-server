/**
 * Fail-closed selection of the Xero tenant a request targets.
 *
 * Adapted from the `selectTenantId` helper proposed by @ryanduguid in
 * XeroAPI/xero-mcp-server#278, changed to request-level semantics: the caller
 * must always name a tenant, and a tenant is never auto-selected.
 */

/** The subset of a Xero connection this module relies on. */
export interface TenantConnection {
  tenantId?: unknown;
}

export const MISSING_TENANT_ID_MESSAGE =
  "This tool requires a tenantId. Use the list-tenants tool to see the organisations this connection is authorised for.";

export const UNKNOWN_TENANT_ID_MESSAGE =
  "The supplied tenantId does not match any authorised Xero connection.";

const authorisedTenantIds = (connections: TenantConnection[]): string[] => {
  const seen = new Set<string>();

  return connections.reduce<string[]>((tenantIds, connection) => {
    const tenantId = connection?.tenantId;

    if (typeof tenantId !== "string") {
      return tenantIds;
    }

    const trimmed = tenantId.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      return tenantIds;
    }

    seen.add(key);
    tenantIds.push(trimmed);
    return tenantIds;
  }, []);
};

/**
 * Returns the authorised tenant ID matching `requestedTenantId`, in the casing
 * Xero reported it.
 *
 * Throws when no tenant was requested or the requested tenant is not
 * authorised. Error messages deliberately never enumerate the authorised
 * tenant IDs.
 */
export const selectTenantId = (
  connections: TenantConnection[],
  requestedTenantId: string | undefined,
): string => {
  const requested = requestedTenantId?.trim() ?? "";

  if (!requested) {
    throw new Error(MISSING_TENANT_ID_MESSAGE);
  }

  const match = authorisedTenantIds(connections).find(
    (tenantId) => tenantId.toLowerCase() === requested.toLowerCase(),
  );

  if (!match) {
    throw new Error(UNKNOWN_TENANT_ID_MESSAGE);
  }

  return match;
};
