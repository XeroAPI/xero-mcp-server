import { describe, it, expect } from "vitest";
import { selectTenantId } from "../tenant-selection.js";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

describe("selectTenantId", () => {
  it("returns the matching tenant ID", () => {
    expect(
      selectTenantId(
        [{ tenantId: TENANT_A }, { tenantId: TENANT_B }],
        TENANT_B,
      ),
    ).toBe(TENANT_B);
  });

  it("matches case-insensitively and returns the canonical casing", () => {
    expect(
      selectTenantId(
        [{ tenantId: "AAAAAAAA-1111-1111-1111-111111111111" }],
        "aaaaaaaa-1111-1111-1111-111111111111",
      ),
    ).toBe("AAAAAAAA-1111-1111-1111-111111111111");
  });

  it("trims surrounding whitespace on the requested value", () => {
    expect(selectTenantId([{ tenantId: TENANT_A }], `  ${TENANT_A}  `)).toBe(
      TENANT_A,
    );
  });

  it("tolerates duplicate connections for the same tenant", () => {
    expect(
      selectTenantId(
        [{ tenantId: TENANT_A }, { tenantId: TENANT_A }],
        TENANT_A,
      ),
    ).toBe(TENANT_A);
  });

  it("ignores connections whose tenantId is not a string", () => {
    expect(
      selectTenantId(
        [{ tenantId: undefined }, { tenantId: 42 }, { tenantId: TENANT_A }],
        TENANT_A,
      ),
    ).toBe(TENANT_A);
  });

  it("rejects an omitted tenant ID", () => {
    expect(() =>
      selectTenantId([{ tenantId: TENANT_A }], undefined),
    ).toThrowError(/requires a tenantId/);
  });

  it("rejects a blank tenant ID", () => {
    expect(() => selectTenantId([{ tenantId: TENANT_A }], "   ")).toThrowError(
      /requires a tenantId/,
    );
  });

  it("rejects an unknown tenant ID", () => {
    expect(() =>
      selectTenantId([{ tenantId: TENANT_A }], TENANT_B),
    ).toThrowError(/does not match any authorised Xero connection/);
  });

  it("never auto-selects when several tenants are authorised", () => {
    expect(() =>
      selectTenantId([{ tenantId: TENANT_A }, { tenantId: TENANT_B }], ""),
    ).toThrowError(/requires a tenantId/);
  });

  it("does not disclose authorised tenant IDs in error messages", () => {
    try {
      selectTenantId([{ tenantId: TENANT_A }, { tenantId: TENANT_B }], "nope");
      throw new Error("expected selectTenantId to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(TENANT_A);
      expect(message).not.toContain(TENANT_B);
    }
  });

  it("rejects when there are no authorised connections", () => {
    expect(() => selectTenantId([], TENANT_A)).toThrowError(
      /does not match any authorised Xero connection/,
    );
  });
});
