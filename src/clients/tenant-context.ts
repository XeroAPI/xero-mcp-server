import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  /**
   * The logical organisation identifier for this request. Used for validation
   * messages and per-tenant cache keys.
   */
  tenantId: string;
  /**
   * The value handed to xero-node API calls. This is the tenant GUID in bearer
   * token mode and the empty string for Custom Connections, whose credential is
   * bound to a single organisation.
   */
  apiTenantId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Runs `fn` with the given tenant bound to the current async execution context.
 */
export const runWithTenant = <T>(
  context: TenantContext,
  fn: () => T | Promise<T>,
): Promise<T> => storage.run(context, async () => fn());

/**
 * Returns the tenant bound to the current request.
 *
 * Throwing here is the structural fail-closed guard: no tenanted Xero call can
 * reach the API unless a tool invocation resolved and validated a tenant first.
 */
export const tenantContext = (): TenantContext => {
  const context = storage.getStore();

  if (!context) {
    throw new Error(
      "No tenant context — tenanted Xero operations must be invoked through an MCP tool call that supplies tenantId.",
    );
  }

  return context;
};

/**
 * The tenant identifier to pass to xero-node accounting/payroll API calls.
 */
export const xeroApiTenantId = (): string => tenantContext().apiTenantId;
