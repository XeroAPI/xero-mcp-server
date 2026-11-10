import { describe, expect, it } from "vitest";
import { LineItem } from "xero-node";
import { formatLineItem } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("includes the line item ID so it can be used to link billable expenses", () => {
    const lineItem = {
      lineItemID: "li-123",
      description: "Consulting services",
      lineAmount: 120,
    } as LineItem;

    const result = formatLineItem(lineItem);

    expect(result).toContain("Line Item ID: li-123");
  });
});
