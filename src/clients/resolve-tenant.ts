import { CustomConnectionsXeroClient, xeroClient } from "./xero-client.js";
import { TenantContext } from "./tenant-context.js";
import {
  MISSING_TENANT_ID_MESSAGE,
  selectTenantId,
} from "./tenant-selection.js";

export const CUSTOM_CONNECTION_MISMATCH_MESSAGE =
  "This server uses a Xero Custom Connection bound to a single organisation; the supplied tenantId does not match it. Omit tenantId or supply the bound organisation's ID (see list-tenants).";

const resolveCustomConnectionTenant = async (
  client: CustomConnectionsXeroClient,
  requestedTenantId: string | undefined,
): Promise<TenantContext> => {
  await client.authenticate();

  const requested = requestedTenantId?.trim() ?? "";
  // The credential is bound to one organisation, so the tenant ID learned from
  // /connections is the only value this server can send. It is the empty string
  // when that lookup did not identify exactly one organisation, which xero-node
  // accepts for Custom Connections.
  const apiTenantId = client.boundTenantId;

  if (!requested) {
    return { tenantId: apiTenantId, apiTenantId };
  }

  const tenantId = await client.resolveBoundOrganisationId(requested);

  if (!tenantId) {
    throw new Error(CUSTOM_CONNECTION_MISMATCH_MESSAGE);
  }

  return { tenantId, apiTenantId };
};

/**
 * Authenticates and resolves the tenant a tool call targets, failing closed if
 * the caller did not name an organisation this credential is authorised for.
 */
export const resolveTenant = async (
  requestedTenantId: string | undefined,
): Promise<TenantContext> => {
  if (xeroClient instanceof CustomConnectionsXeroClient) {
    return resolveCustomConnectionTenant(xeroClient, requestedTenantId);
  }

  // A request that names no tenant can never succeed in bearer token mode, so
  // reject it before spending an authentication round trip.
  if (!requestedTenantId?.trim()) {
    throw new Error(MISSING_TENANT_ID_MESSAGE);
  }

  await xeroClient.authenticate();

  const tenantId = selectTenantId(xeroClient.tenants, requestedTenantId);

  return { tenantId, apiTenantId: tenantId };
};
