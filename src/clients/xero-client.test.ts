import { describe, expect, it } from "vitest";

process.env.XERO_CLIENT_ID ??= "test-client-id";
process.env.XERO_CLIENT_SECRET ??= "test-client-secret";

// Static imports are hoisted above the env fallbacks, so import dynamically.
const { selectTenantId } = await import("./xero-client.js");

describe("selectTenantId", () => {
  const tenants = [
    { tenantId: "tenant-a", tenantName: "Org A" },
    { tenantId: "tenant-b", tenantName: "Org B" },
  ];

  it("falls back to the first tenant when nothing is pinned", () => {
    expect(selectTenantId(tenants)).toBe("tenant-a");
  });

  it("returns the pinned tenant when it is connected", () => {
    expect(selectTenantId(tenants, "tenant-b")).toBe("tenant-b");
  });

  it("throws listing the connected tenants when the pin is unknown", () => {
    expect(() => selectTenantId(tenants, "tenant-c")).toThrowError(
      "XERO_TENANT_ID tenant-c is not connected to this app. Connected tenants: Org A (tenant-a), Org B (tenant-b)",
    );
  });

  it("throws mentioning no tenants when the app has none", () => {
    expect(() => selectTenantId([], "tenant-a")).toThrowError(
      "Connected tenants: none",
    );
  });
});
