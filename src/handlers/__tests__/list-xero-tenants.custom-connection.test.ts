import { describe, it, expect, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  delete process.env.XERO_CLIENT_BEARER_TOKEN;
  process.env.XERO_CLIENT_ID = "test-client-id";
  process.env.XERO_CLIENT_SECRET = "test-client-secret";
});

const { listXeroTenants } = await import("../list-xero-tenants.handler.js");
const { xeroClient } = await import("../../clients/xero-client.js");

const BOUND_TENANT = "11111111-1111-1111-1111-111111111111";

const client =
  xeroClient as import("../../clients/xero-client.js").CustomConnectionsXeroClient;

const getOrganisations = vi.fn();

beforeEach(() => {
  vi.spyOn(client, "authenticate").mockResolvedValue();
  getOrganisations.mockReset();
  getOrganisations.mockResolvedValue({
    body: {
      organisations: [{ organisationID: BOUND_TENANT, name: "Bound Org" }],
    },
  });
  vi.spyOn(client, "accountingApi", "get").mockReturnValue({
    getOrganisations,
  } as never);
  Reflect.set(client, "connectionTenantIds", []);
  Reflect.set(client, "boundOrganisation", undefined);
});

describe("listXeroTenants (Custom Connection mode)", () => {
  it("returns the single bound organisation", async () => {
    const response = await listXeroTenants();

    expect(response.error).toBeNull();
    expect(response.result).toEqual({
      authMode: "custom-connection",
      tenants: [
        {
          tenantId: BOUND_TENANT,
          tenantName: "Bound Org",
          tenantType: "ORGANISATION",
        },
      ],
    });
    expect(getOrganisations).toHaveBeenCalledWith("");
  });

  it("prefers the tenant ID learned from /connections", async () => {
    Reflect.set(client, "connectionTenantIds", [BOUND_TENANT]);
    getOrganisations.mockResolvedValue({
      body: { organisations: [{ name: "Bound Org" }] },
    });

    const response = await listXeroTenants();

    expect(response.result?.tenants[0].tenantId).toBe(BOUND_TENANT);
  });
});
