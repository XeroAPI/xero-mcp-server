import { describe, it, expect } from "vitest";
import { selectTenantId } from "../select-tenant-id.js";

const connections = [
  { tenantId: "aaaa-1111" },
  { tenantId: "bbbb-2222" },
  { tenantId: "cccc-3333" },
];

describe("selectTenantId", () => {
  it("returns the first connection when no tenant is requested", () => {
    expect(selectTenantId(connections)).toBe("aaaa-1111");
  });

  it("returns the first connection when the requested tenant is an empty string", () => {
    expect(selectTenantId(connections, "")).toBe("aaaa-1111");
  });

  it("returns the requested tenant when it is an authorised connection", () => {
    expect(selectTenantId(connections, "bbbb-2222")).toBe("bbbb-2222");
  });

  it("throws when the requested tenant is not an authorised connection", () => {
    expect(() => selectTenantId(connections, "dddd-4444")).toThrowError(
      'XERO_TENANT_ID "dddd-4444" does not match any authorised connection. Available tenant IDs: aaaa-1111, bbbb-2222, cccc-3333',
    );
  });

  it("never silently falls back to the first tenant on a mismatch", () => {
    expect(() => selectTenantId(connections, "dddd-4444")).toThrow();
  });
});
