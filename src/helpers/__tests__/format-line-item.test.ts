import { describe, expect, it } from "vitest";
import { LineItem } from "xero-node";
import { formatLineItem } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("includes the Xero line item ID needed for updates", () => {
    const text = formatLineItem({
      lineItemID: "line-item-id",
      description: "Consulting services",
    } as LineItem);

    expect(text).toContain("Line Item ID: line-item-id");
  });

  it("includes zero-valued sales invoice discounts", () => {
    const text = formatLineItem({
      discountRate: 0,
      discountAmount: 0,
    } as LineItem);

    expect(text).toContain("Discount Rate: 0");
    expect(text).toContain("Discount Amount: 0");
  });
});
