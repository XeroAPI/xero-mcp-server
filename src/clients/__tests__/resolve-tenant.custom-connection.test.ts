import { describe, it, expect, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  delete process.env.XERO_CLIENT_BEARER_TOKEN;
  process.env.XERO_CLIENT_ID = "test-client-id";
  process.env.XERO_CLIENT_SECRET = "test-client-secret";
});

const { resolveTenant } = await import("../resolve-tenant.js");
const { xeroClient, authMode } = await import("../xero-client.js");

const BOUND_TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER_TENANT = "22222222-2222-2222-2222-222222222222";

const client =
  xeroClient as import("../xero-client.js").CustomConnectionsXeroClient;

const authenticate = vi.spyOn(client, "authenticate").mockResolvedValue();
const getOrganisations = vi.fn();

beforeEach(() => {
  authenticate.mockClear();
  getOrganisations.mockReset();
  getOrganisations.mockResolvedValue({
    body: { organisations: [{ organisationID: BOUND_TENANT, name: "Org" }] },
  });
  vi.spyOn(client, "accountingApi", "get").mockReturnValue({
    getOrganisations,
  } as never);
  // Reset the per-process caches this client keeps.
  Reflect.set(client, "connectionTenantIds", []);
  Reflect.set(client, "boundOrganisation", undefined);
});

describe("resolveTenant (Custom Connection mode)", () => {
  it("runs in custom connection mode", () => {
    expect(authMode).toBe("custom-connection");
  });

  it("uses the empty wire tenant ID when tenantId is omitted", async () => {
    expect(await resolveTenant(undefined)).toEqual({
      tenantId: "",
      apiTenantId: "",
    });
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(getOrganisations).not.toHaveBeenCalled();
  });

  it("sends the bound tenant ID learned from /connections on the wire", async () => {
    Reflect.set(client, "connectionTenantIds", [BOUND_TENANT]);

    expect(await resolveTenant(undefined)).toEqual({
      tenantId: BOUND_TENANT,
      apiTenantId: BOUND_TENANT,
    });
  });

  it("accepts the bound tenant ID learned from /connections without an extra API call", async () => {
    Reflect.set(client, "connectionTenantIds", [BOUND_TENANT]);

    expect(await resolveTenant(BOUND_TENANT)).toEqual({
      tenantId: BOUND_TENANT,
      apiTenantId: BOUND_TENANT,
    });
    expect(getOrganisations).not.toHaveBeenCalled();
  });

  it("accepts the bound organisation ID reported by the accounting API, canonicalised", async () => {
    expect(await resolveTenant(BOUND_TENANT.toUpperCase())).toEqual({
      tenantId: BOUND_TENANT,
      apiTenantId: "",
    });
    expect(getOrganisations).toHaveBeenCalledWith("");
  });

  it("distrusts the /connections list when it names more than one organisation", async () => {
    // A Custom Connection is bound to one organisation, so a multi-entry
    // /connections response is a contract violation: only the organisation the
    // credential actually reaches may be trusted.
    Reflect.set(client, "connectionTenantIds", [BOUND_TENANT, OTHER_TENANT]);

    await expect(resolveTenant(OTHER_TENANT)).rejects.toThrowError(
      /bound to a single organisation/,
    );

    expect(await resolveTenant(BOUND_TENANT.toUpperCase())).toEqual({
      tenantId: BOUND_TENANT,
      apiTenantId: "",
    });
  });

  it("caches the bound organisation lookup", async () => {
    await resolveTenant(BOUND_TENANT);
    await resolveTenant(BOUND_TENANT);

    expect(getOrganisations).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the supplied tenantId is not the bound organisation", async () => {
    await expect(resolveTenant(OTHER_TENANT)).rejects.toThrowError(
      /bound to a single organisation/,
    );
  });
});
