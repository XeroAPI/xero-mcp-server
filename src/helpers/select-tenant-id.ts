interface TenantConnection {
  tenantId: string;
}

/**
 * Thrown when `XERO_TENANT_ID` names an organisation the credentials aren't
 * authorised for. A configuration error, not an authentication failure, so
 * callers pass it through unchanged.
 */
export class TenantSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantSelectionError";
  }
}

/**
 * Selects the tenant to use from the authorised connections.
 *
 * When `requestedTenantId` (the `XERO_TENANT_ID` environment variable) is
 * set, the matching connection is used. Tenant IDs are GUIDs, so the match
 * ignores case and surrounding whitespace, and the ID is returned as Xero
 * wrote it. If nothing matches, or there are no connections at all, a
 * `TenantSelectionError` is thrown rather than silently falling back, so a
 * misconfigured server never reads or writes against the wrong organisation.
 * The error says how many organisations the credentials can reach, but not
 * which, since tool output can reach an LLM or logs.
 * When it is not set (or blank), the first connection is used (existing
 * behaviour), or `undefined` if there are none.
 */
export function selectTenantId(
  connections: TenantConnection[],
  requestedTenantId?: string,
): string | undefined {
  const requested = requestedTenantId?.trim();
  if (!requested) {
    return connections[0]?.tenantId;
  }

  if (connections.length === 0) {
    throw new TenantSelectionError(
      `XERO_TENANT_ID "${requested}" is set, but these credentials aren't authorised for any organisation. ` +
        "Check the connections with GET https://api.xero.com/connections.",
    );
  }

  const match = connections.find(
    (connection) =>
      connection.tenantId.toLowerCase() === requested.toLowerCase(),
  );

  if (!match) {
    const authorised =
      connections.length === 1
        ? "the one organisation"
        : `any of the ${connections.length} organisations`;
    throw new TenantSelectionError(
      `XERO_TENANT_ID "${requested}" does not match ${authorised} these credentials are authorised for. ` +
        "Check the value against GET https://api.xero.com/connections.",
    );
  }

  return match.tenantId;
}
