import { describe, expect, it } from "vitest";
import { formatLineItem } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("includes the line item ID needed for targeted updates", () => {
    expect(
      formatLineItem({
        lineItemID: "line-item-id",
        description: "Consulting",
      }),
    ).toContain("Line Item ID: line-item-id");
  });
});
