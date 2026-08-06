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
});
