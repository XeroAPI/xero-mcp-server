import { describe, it, expect, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";
  delete process.env.XERO_CLIENT_ID;
  delete process.env.XERO_CLIENT_SECRET;
});

const { listXeroTenants } = await import("../list-xero-tenants.handler.js");
const { xeroClient } = await import("../../clients/xero-client.js");
const ListTenantsTool = (await import("../../tools/list/list-tenants.tool.js"))
  .default;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.spyOn(xeroClient, "authenticate").mockResolvedValue();
  vi.spyOn(xeroClient, "tenants", "get").mockReturnValue([
    {
      tenantId: TENANT_A,
      tenantName: "Org A",
      tenantType: "ORGANISATION",
      // Fields the tool must not echo back.
      createdDateUtc: "2020-01-01T00:00:00Z",
      authEventId: "99999999-9999-9999-9999-999999999999",
    },
    { tenantId: TENANT_B, tenantName: "Org B", tenantType: "ORGANISATION" },
  ]);
});

describe("listXeroTenants (bearer token mode)", () => {
  it("returns the authorised organisations", async () => {
    const response = await listXeroTenants();

    expect(response.error).toBeNull();
    expect(response.result).toEqual({
      authMode: "bearer",
      tenants: [
        {
          tenantId: TENANT_A,
          tenantName: "Org A",
          tenantType: "ORGANISATION",
        },
        {
          tenantId: TENANT_B,
          tenantName: "Org B",
          tenantType: "ORGANISATION",
        },
      ],
    });
  });

  it("requires no tenantId and lists each organisation", async () => {
    const tool = ListTenantsTool();

    expect(tool.schema).toEqual({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tool.handler as any)({}, {} as never);
    const text = result.content
      .map((entry: { text: string }) => entry.text)
      .join("\n");

    expect(text).toContain(TENANT_A);
    expect(text).toContain(TENANT_B);
    expect(text).not.toContain("authEventId");
    expect(text).not.toContain("99999999-9999-9999-9999-999999999999");
  });
});
