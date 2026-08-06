import { describe, expect, it } from "vitest";
import { formatLineItem } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("renders supplied line-item details without object coercion", () => {
    expect(formatLineItem({
      lineItemID: "line-item-id",
      item: { itemID: "item-id" },
      itemCode: "CONSULT",
      description: "Consulting services",
      quantity: 0,
      unitAmount: 0,
      accountCode: "200",
      taxType: "OUTPUT",
      taxAmount: 0,
      discountRate: 0,
      discountAmount: 0,
      tracking: [{
        trackingCategoryID: "tracking-category-id",
        trackingOptionID: "tracking-option-id",
      }],
      lineAmount: 0,
    })).toBe([
      "Line Item ID: line-item-id",
      "Item ID: item-id",
      "Item Code: CONSULT",
      "Description: Consulting services",
      "Quantity: 0",
      "Unit Amount: 0",
      "Account Code: 200",
      "Tax Type: OUTPUT",
      "Tax Amount: 0",
      "Discount Rate: 0",
      "Discount Amount: 0",
      "Tracking: tracking-category-id=tracking-option-id",
      "Line Amount: 0",
    ].join("\n"));
  });

  it("omits unavailable fields instead of rendering undefined", () => {
    expect(formatLineItem({ description: "Narrative line" })).toBe(
      "Description: Narrative line",
    );
  });
});
