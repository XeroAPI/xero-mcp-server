import { describe, it, expect } from "vitest";
import { trackingSchema } from "../tracking-schema.js";

describe("trackingSchema", () => {
  it("accepts a category name and option with no tracking category ID", () => {
    expect(trackingSchema.parse({ name: "Property", option: "CG" })).toEqual({
      name: "Property",
      option: "CG",
    });
  });

  it("accepts an explicit tracking category ID", () => {
    const tracking = {
      name: "Property",
      option: "CG",
      trackingCategoryID: "9c8f5f6d-8b0e-4a6f-9d2c-1e3a5b7c9d11",
    };

    expect(trackingSchema.parse(tracking)).toEqual(tracking);
  });

  it("rejects a tracking entry with no category name", () => {
    expect(() => trackingSchema.parse({ option: "CG" })).toThrow();
  });

  it("rejects a tracking entry with no option", () => {
    expect(() => trackingSchema.parse({ name: "Property" })).toThrow();
  });
});
