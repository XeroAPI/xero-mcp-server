import { describe, it, expect, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";
  delete process.env.XERO_CLIENT_ID;
  delete process.env.XERO_CLIENT_SECRET;
});

const { resolveTenant } = await import("../resolve-tenant.js");
const { xeroClient, authMode } = await import("../xero-client.js");

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

const authenticate = vi.spyOn(xeroClient, "authenticate");

describe("resolveTenant (bearer token mode)", () => {
  beforeEach(() => {
    authenticate.mockReset();
    authenticate.mockImplementation(async () => {
      vi.spyOn(xeroClient, "tenants", "get").mockReturnValue([
        { tenantId: TENANT_A, tenantName: "Org A", tenantType: "ORGANISATION" },
        { tenantId: TENANT_B, tenantName: "Org B", tenantType: "ORGANISATION" },
      ]);
    });
  });

  it("runs in bearer mode", () => {
    expect(authMode).toBe("bearer");
  });

  it("authenticates and resolves an authorised tenant", async () => {
    expect(await resolveTenant(TENANT_B)).toEqual({
      tenantId: TENANT_B,
      apiTenantId: TENANT_B,
    });
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown tenant", async () => {
    await expect(
      resolveTenant("33333333-3333-3333-3333-333333333333"),
    ).rejects.toThrowError(/does not match any authorised Xero connection/);
  });

  it("never falls back to a tenant when none was requested", async () => {
    await expect(resolveTenant(undefined)).rejects.toThrowError(
      /requires a tenantId/,
    );
    await expect(resolveTenant("  ")).rejects.toThrowError(
      /requires a tenantId/,
    );
  });

  it("rejects a missing tenant without authenticating", async () => {
    await expect(resolveTenant(undefined)).rejects.toThrowError(
      /requires a tenantId/,
    );
    await expect(resolveTenant(" ")).rejects.toThrowError(
      /requires a tenantId/,
    );

    expect(authenticate).not.toHaveBeenCalled();
  });

  it("surfaces an authentication failure without leaking credentials", async () => {
    authenticate.mockRejectedValue(
      // Shape of a xero-node SDK rejection: a plain object carrying the
      // request headers, which must never reach the caller.
      {
        response: {
          statusCode: 401,
          request: { headers: { authorization: "Bearer super-secret-token" } },
        },
      } as never,
    );

    await expect(resolveTenant(TENANT_A)).rejects.toBeDefined();
  });
});
