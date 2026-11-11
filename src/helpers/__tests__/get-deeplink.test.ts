import { describe, it, expect, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";
  delete process.env.XERO_CLIENT_ID;
  delete process.env.XERO_CLIENT_SECRET;
});

const { getDeepLink, DeepLinkType } = await import("../get-deeplink.js");
const { xeroClient } = await import("../../clients/xero-client.js");
const { runWithTenant } = await import("../../clients/tenant-context.js");

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

const shortCodes: Record<string, string> = {
  [TENANT_A]: "!aaaaa",
  [TENANT_B]: "!bbbbb",
};

const getOrganisations = vi.fn();

beforeEach(() => {
  getOrganisations.mockReset();
  getOrganisations.mockImplementation(async (apiTenantId: string) => ({
    body: { organisations: [{ shortCode: shortCodes[apiTenantId] }] },
  }));
  vi.spyOn(xeroClient, "accountingApi", "get").mockReturnValue({
    getOrganisations,
  } as never);
  Reflect.get(xeroClient, "shortCodes")?.clear();
});

const invoiceLink = (tenantId: string) =>
  runWithTenant({ tenantId, apiTenantId: tenantId }, () =>
    getDeepLink(DeepLinkType.INVOICE, "33333333-3333-3333-3333-333333333333"),
  );

describe("getDeepLink", () => {
  it("throws outside a tenant context", async () => {
    await expect(getDeepLink(DeepLinkType.INVOICE, "id")).rejects.toThrowError(
      /No tenant context/,
    );
    expect(getOrganisations).not.toHaveBeenCalled();
  });

  it("uses the short code of the tenant the request targets", async () => {
    expect(await invoiceLink(TENANT_A)).toContain("!aaaaa");
    expect(await invoiceLink(TENANT_B)).toContain("!bbbbb");
  });

  it("caches short codes per tenant without bleeding between them", async () => {
    await invoiceLink(TENANT_A);
    await invoiceLink(TENANT_A);
    await invoiceLink(TENANT_B);

    expect(getOrganisations.mock.calls.map(([tenantId]) => tenantId)).toEqual([
      TENANT_A,
      TENANT_B,
    ]);
    expect(await invoiceLink(TENANT_B)).toContain("!bbbbb");
  });
});
