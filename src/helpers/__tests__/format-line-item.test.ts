import { describe, it, expect } from "vitest";
import { LineItem } from "xero-node";
import { formatLineItem } from "../format-line-item.js";

describe("formatLineItem", () => {
  it("renders tracking as name=option, comma-separated", () => {
    const lineItem = {
      description: "Consulting",
      quantity: 1,
      unitAmount: 10,
      accountCode: "200",
      taxType: "OUTPUT",
      lineAmount: 10,
      tracking: [
        { name: "Region", option: "West" },
        { name: "Team", option: "Alpha" },
      ],
    } as LineItem;

    expect(formatLineItem(lineItem)).toContain("Tracking: Region=West, Team=Alpha");
  });

  it("renders empty tracking when undefined (no throw, no [object Object])", () => {
    const lineItem = {
      description: "Consulting",
      lineAmount: 10,
    } as LineItem;

    const output = formatLineItem(lineItem);
    expect(output).toContain("Tracking: ");
    expect(output).not.toContain("[object Object]");
  });

  it("renders the item's itemID as a string, not [object Object]", () => {
    const lineItem = {
      itemCode: "ABC",
      item: { code: "ABC", name: "Widget", itemID: "abc-123" },
      lineAmount: 10,
    } as LineItem;

    const output = formatLineItem(lineItem);
    expect(output).toContain("Item ID: abc-123");
    expect(output).not.toContain("[object Object]");
  });
});
