import { describe, expect, it } from "vitest";

import { selectTenantId } from "../tenant-selection.js";

describe("selectTenantId", () => {
  it("uses the only available tenant when none is configured", () => {
    expect(selectTenantId([{ tenantId: "tenant-a" }], undefined)).toBe(
      "tenant-a",
    );
  });

  it("uses an explicitly configured tenant from multiple connections", () => {
    expect(
      selectTenantId(
        [{ tenantId: "tenant-a" }, { tenantId: "tenant-b" }],
        "tenant-b",
      ),
    ).toBe("tenant-b");
  });

  it("allows accidental surrounding whitespace in a configured tenant ID", () => {
    expect(selectTenantId([{ tenantId: "tenant-a" }], " tenant-a ")).toBe(
      "tenant-a",
    );
  });

  it("matches a configured tenant GUID case-insensitively and returns the connection's canonical casing", () => {
    expect(
      selectTenantId(
        [{ tenantId: "1f9284a4-af92-4a2c-a217-4830a2f4b581" }],
        "1F9284A4-AF92-4A2C-A217-4830A2F4B581",
      ),
    ).toBe("1f9284a4-af92-4a2c-a217-4830a2f4b581");
  });

  it("rejects an explicit tenant that is not available to the credential", () => {
    expect(() =>
      selectTenantId([{ tenantId: "tenant-a" }], "tenant-b"),
    ).toThrow(
      "XERO_TENANT_ID does not match an available Xero tenant connection.",
    );
  });

  it("rejects a blank explicitly configured tenant", () => {
    expect(() => selectTenantId([{ tenantId: "tenant-a" }], "  ")).toThrow(
      "XERO_TENANT_ID must not be blank when it is set.",
    );
  });

  it("fails closed when multiple tenants are available without configuration", () => {
    expect(() =>
      selectTenantId(
        [{ tenantId: "tenant-a" }, { tenantId: "tenant-b" }],
        undefined,
      ),
    ).toThrow("Multiple Xero tenant connections are available.");
  });

  it("rejects credentials that have no usable tenant connections", () => {
    expect(() => selectTenantId([], undefined)).toThrow(
      "No Xero tenant connections were returned.",
    );
  });

  it("fails closed when a connection response has no string tenant IDs", () => {
    expect(() => selectTenantId([{ tenantId: 123 }], undefined)).toThrow(
      "No Xero tenant connections were returned.",
    );
  });

  it("does not treat duplicate connection entries as multiple tenants", () => {
    expect(
      selectTenantId(
        [{ tenantId: "tenant-a" }, { tenantId: "tenant-a" }],
        undefined,
      ),
    ).toBe("tenant-a");
  });
});
