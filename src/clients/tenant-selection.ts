export interface TenantConnection {
  tenantId?: unknown;
}

/**
 * Selects the Xero tenant that this server may use.
 *
 * Choosing the first connection is unsafe when a credential can access more
 * than one organisation. In that case, callers must configure a tenant ID
 * explicitly so the intended organisation is unambiguous.
 */
export function selectTenantId(
  connections: readonly TenantConnection[],
  configuredTenantId: string | undefined,
): string {
  const tenantIds = [
    ...new Set(
      connections
        .map((connection) =>
          typeof connection.tenantId === "string"
            ? connection.tenantId.trim()
            : undefined,
        )
        .filter((tenantId): tenantId is string => Boolean(tenantId)),
    ),
  ];

  if (configuredTenantId !== undefined) {
    const tenantId = configuredTenantId.trim();

    if (!tenantId) {
      throw new Error("XERO_TENANT_ID must not be blank when it is set.");
    }

    // Tenant IDs are GUIDs, which are case-insensitive. Match accordingly,
    // but return the connection's canonical casing for use in API headers.
    const normalizedTenantId = tenantId.toLowerCase();
    const matchedTenantId = tenantIds.find(
      (candidate) => candidate.toLowerCase() === normalizedTenantId,
    );

    if (matchedTenantId === undefined) {
      throw new Error(
        "XERO_TENANT_ID does not match an available Xero tenant connection.",
      );
    }

    return matchedTenantId;
  }

  if (tenantIds.length === 1) {
    return tenantIds[0]!;
  }

  if (tenantIds.length === 0) {
    throw new Error(
      "No Xero tenant connections were returned. Check that the credentials can access an organisation.",
    );
  }

  throw new Error(
    "Multiple Xero tenant connections are available. Set XERO_TENANT_ID to the intended organisation's tenant ID.",
  );
}
