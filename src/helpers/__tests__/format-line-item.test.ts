import { describe, it, expect } from "vitest";
import { LineItem } from "xero-node";
import { formatLineItem } from "../format-line-item.js";

const lineOf = (text: string, label: string): string | undefined =>
  text.split("\n").find((line) => line.startsWith(`${label}: `));

describe("formatLineItem", () => {
  it("renders the item ID rather than the item object", () => {
    const lineItem: LineItem = {
      item: { itemID: "item-1", code: "CONSULT", name: "Consulting" },
    };

    expect(lineOf(formatLineItem(lineItem), "Item ID")).toBe("Item ID: item-1");
  });

  it("renders each tracking category and option", () => {
    const lineItem: LineItem = {
      tracking: [
        { name: "Region", option: "North" },
        { name: "Team", option: "Blue" },
      ],
    };

    expect(lineOf(formatLineItem(lineItem), "Tracking")).toBe(
      "Tracking: Region: North; Team: Blue",
    );
  });

  it("does not render tracking as [object Object]", () => {
    const formatted = formatLineItem({
      item: { itemID: "item-1" },
      tracking: [{ name: "Region", option: "North" }],
    });

    expect(formatted).not.toContain("[object Object]");
  });

  it("keeps every other field on its existing line", () => {
    const formatted = formatLineItem({
      itemCode: "CONSULT",
      description: "Consulting",
      quantity: 2,
      unitAmount: 150,
      accountCode: "200",
      taxType: "OUTPUT2",
      lineAmount: 300,
    });

    expect(formatted.split("\n")).toEqual([
      "Item ID: undefined",
      "Item Code: CONSULT",
      "Description: Consulting",
      "Quantity: 2",
      "Unit Amount: 150",
      "Account Code: 200",
      "Tax Type: OUTPUT2",
      "Tracking: undefined",
      "Line Amount: 300",
    ]);
  });
});
