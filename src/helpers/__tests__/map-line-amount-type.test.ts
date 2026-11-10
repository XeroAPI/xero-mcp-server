import { describe, it, expect } from "vitest";
import { LineAmountTypes } from "xero-node";
import { mapLineAmountType } from "../map-line-amount-type.js";

describe("mapLineAmountType", () => {
  it("maps EXCLUSIVE to the Xero Exclusive value", () => {
    expect(mapLineAmountType("EXCLUSIVE")).toBe(LineAmountTypes.Exclusive);
  });

  it("maps INCLUSIVE to the Xero Inclusive value", () => {
    expect(mapLineAmountType("INCLUSIVE")).toBe(LineAmountTypes.Inclusive);
  });

  it("maps NO_TAX to the Xero NoTax value", () => {
    expect(mapLineAmountType("NO_TAX")).toBe(LineAmountTypes.NoTax);
  });

  it("returns undefined when no value is supplied", () => {
    expect(mapLineAmountType(undefined)).toBeUndefined();
  });

  it("produces the real Xero string values, not the tool input strings", () => {
    // Regression guard: a `as LineAmountTypes` cast used to pass the raw tool
    // string through, sending an invalid value Xero rejects.
    expect(mapLineAmountType("NO_TAX")).toBe("NoTax");
    expect(mapLineAmountType("EXCLUSIVE")).toBe("Exclusive");
    expect(mapLineAmountType("INCLUSIVE")).toBe("Inclusive");
    expect(mapLineAmountType("NO_TAX")).not.toBe("NO_TAX");
  });
});
