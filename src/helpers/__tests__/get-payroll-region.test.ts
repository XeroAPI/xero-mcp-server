import { describe, expect, it } from "vitest";
import { CountryCode } from "xero-node";

import { toPayrollRegion } from "../get-payroll-region.js";

describe("toPayrollRegion", () => {
  it("maps AU from string and enum", () => {
    expect(toPayrollRegion("AU")).toBe("AU");
    expect(toPayrollRegion(CountryCode.AU)).toBe("AU");
  });

  it("maps NZ and GB", () => {
    expect(toPayrollRegion("NZ")).toBe("NZ");
    expect(toPayrollRegion(CountryCode.NZ)).toBe("NZ");
    expect(toPayrollRegion("GB")).toBe("UK");
    expect(toPayrollRegion(CountryCode.GB)).toBe("UK");
  });

  it("returns OTHER for missing or unknown codes", () => {
    expect(toPayrollRegion(undefined)).toBe("OTHER");
    expect(toPayrollRegion("US")).toBe("OTHER");
  });
});
