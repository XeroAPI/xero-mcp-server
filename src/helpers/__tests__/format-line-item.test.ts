import { describe, it, expect } from "vitest";
import { LineItem } from "xero-node";
import { formatLineItem, formatLineItems } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("renders all present fields with tracking and item ID", () => {
    const lineItem = {
      item: { itemID: "item-1" },
      itemCode: "WIDGET",
      description: "Widget",
      quantity: 2,
      unitAmount: 5,
      accountCode: "200",
      taxType: "OUTPUT",
      tracking: [
        { name: "Region", option: "North" },
        { name: "Dept", option: "Sales" },
      ],
      lineAmount: 10,
    } as LineItem;

    expect(formatLineItem(lineItem)).toBe(
      [
        "Item ID: item-1",
        "Item Code: WIDGET",
        "Description: Widget",
        "Quantity: 2",
        "Unit Amount: 5",
        "Account Code: 200",
        "Tax Type: OUTPUT",
        "Tracking: Region: North, Dept: Sales",
        "Line Amount: 10",
      ].join("\n"),
    );
  });

  it("omits absent fields instead of printing undefined", () => {
    const output = formatLineItem({ description: "Heading only" } as LineItem);
    expect(output).toBe("Description: Heading only");
    expect(output).not.toContain("undefined");
  });

  it("keeps zero values", () => {
    expect(
      formatLineItem({ quantity: 0, lineAmount: 0 } as LineItem),
    ).toBe("Quantity: 0\nLine Amount: 0");
  });
});

describe("formatLineItems", () => {
  it("returns 'none' when line items are missing or empty", () => {
    expect(formatLineItems(undefined)).toBe("Line Items: none");
    expect(formatLineItems([])).toBe("Line Items: none");
  });

  it("separates multiple line items with a blank line", () => {
    expect(
      formatLineItems([
        { description: "A" } as LineItem,
        { description: "B" } as LineItem,
      ]),
    ).toBe("Line Items:\nDescription: A\n\nDescription: B");
  });
});
