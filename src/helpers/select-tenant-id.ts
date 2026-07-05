interface TenantConnection {
  tenantId: string;
}

/**
 * Selects the tenant to use from the authorised connections.
 *
 * When `requestedTenantId` (the `XERO_TENANT_ID` environment variable) is
 * set, the matching connection is used; if it does not match any authorised
 * connection an error is thrown rather than silently falling back, so a
 * misconfigured server never reads or writes against the wrong organisation.
 * When it is not set, the first connection is used (existing behaviour).
 */
export function selectTenantId(
  connections: TenantConnection[],
  requestedTenantId?: string,
): string {
  if (!requestedTenantId) {
    return connections[0].tenantId;
  }

  const match = connections.find(
    (connection) => connection.tenantId === requestedTenantId,
  );

  if (!match) {
    const available = connections
      .map((connection) => connection.tenantId)
      .join(", ");
    throw new Error(
      `XERO_TENANT_ID "${requestedTenantId}" does not match any authorised connection. Available tenant IDs: ${available}`,
    );
  }

  return match.tenantId;
}
