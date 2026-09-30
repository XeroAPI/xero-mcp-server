import { describe, it, expect } from "vitest";
import { selectTenantId, TenantSelectionError } from "../select-tenant-id.js";

const connections = [
  { tenantId: "aaaa-1111" },
  { tenantId: "bbbb-2222" },
  { tenantId: "cccc-3333" },
];

describe("selectTenantId", () => {
  it("returns the first connection when no tenant is requested", () => {
    expect(selectTenantId(connections)).toBe("aaaa-1111");
  });

  it("returns the first connection when the requested tenant is blank", () => {
    expect(selectTenantId(connections, "")).toBe("aaaa-1111");
    expect(selectTenantId(connections, "   ")).toBe("aaaa-1111");
  });

  it("returns the requested tenant when it is an authorised connection", () => {
    expect(selectTenantId(connections, "bbbb-2222")).toBe("bbbb-2222");
  });

  it("ignores case and surrounding whitespace, returning Xero's spelling", () => {
    expect(selectTenantId(connections, "  BBBB-2222\n")).toBe("bbbb-2222");
  });

  it("throws instead of falling back when the requested tenant is not authorised", () => {
    expect(() => selectTenantId(connections, "dddd-4444")).toThrowError(
      new TenantSelectionError(
        'XERO_TENANT_ID "dddd-4444" does not match any organisation these credentials are authorised for. ' +
          "Check the value against GET https://api.xero.com/connections.",
      ),
    );
  });

  it("does not reveal the authorised tenant IDs in the error", () => {
    expect(() => selectTenantId(connections, "dddd-4444")).toThrowError(
      expect.objectContaining({
        message: expect.not.stringMatching(/aaaa-1111|bbbb-2222|cccc-3333/),
      }),
    );
  });
});
