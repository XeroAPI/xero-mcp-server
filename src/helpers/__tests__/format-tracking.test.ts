import { describe, it, expect } from "vitest";
import { TrackingCategory } from "xero-node";
import { formatTracking } from "../format-tracking.js";

describe("formatTracking", () => {
  it("returns null when tracking is undefined", () => {
    expect(formatTracking(undefined)).toBeNull();
  });

  it("returns null when tracking is an empty array", () => {
    expect(formatTracking([])).toBeNull();
  });

  it("formats a single category/option pair", () => {
    const tracking: TrackingCategory[] = [{ name: "Property", option: "CG" }];
    expect(formatTracking(tracking)).toBe("Property/CG");
  });

  it("formats multiple category/option pairs comma-separated", () => {
    const tracking: TrackingCategory[] = [
      { name: "Property", option: "CG" },
      { name: "Region", option: "East" },
    ];
    expect(formatTracking(tracking)).toBe("Property/CG, Region/East");
  });

  it("renders readable text rather than [object Object]", () => {
    const tracking: TrackingCategory[] = [{ name: "Property", option: "ES" }];
    expect(formatTracking(tracking)).not.toContain("[object Object]");
  });

  it("falls back to the category name when option is missing", () => {
    const tracking: TrackingCategory[] = [{ name: "Property" }];
    expect(formatTracking(tracking)).toBe("Property");
  });

  it("skips entries that have neither name nor option", () => {
    const tracking: TrackingCategory[] = [
      { name: "Property", option: "CG" },
      {},
    ];
    expect(formatTracking(tracking)).toBe("Property/CG");
  });

  it("returns null when every entry is empty", () => {
    const tracking: TrackingCategory[] = [{}, {}];
    expect(formatTracking(tracking)).toBeNull();
  });
});
