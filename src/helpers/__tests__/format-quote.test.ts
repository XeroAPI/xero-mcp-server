import { describe, expect, it } from "vitest";
import { LineItem, Quote } from "xero-node";
import {
  formatQuote,
  formatQuoteLineItem,
  formatQuoteLineItems,
} from "../format-quote.js";

const lineItems: LineItem[] = [
  {
    itemCode: "Train-MS",
    description: "Half day training - Microsoft Office",
    quantity: 1,
    unitAmount: 500,
    accountCode: "400",
    taxType: "NONE",
    lineAmount: 500,
    tracking: [{ name: "Avengers", option: "IronMan" }],
  },
  {
    description: "Travel expenses",
    quantity: 2,
    unitAmount: 50,
    accountCode: "400",
    taxType: "NONE",
    lineAmount: 100,
  },
];

describe("formatQuoteLineItem", () => {
  it("prints the fields needed to recreate a create-invoice line", () => {
    expect(formatQuoteLineItem(lineItems[0], 0)).toBe(
      [
        "1.",
        "Item Code: Train-MS",
        "Description: Half day training - Microsoft Office",
        "Quantity: 1",
        "Unit Amount: 500",
        "Account Code: 400",
        "Tax Type: NONE",
        "Line Amount: 500",
        "Tracking: Avengers: IronMan",
      ].join("\n"),
    );
  });

  it("does not stringify item or tracking objects", () => {
    const text = formatQuoteLineItem(
      {
        description: "Widget",
        quantity: 1,
        unitAmount: 10,
        item: { code: "W1", name: "Widget" },
        tracking: [{ name: "Region", option: "East" }],
      },
      0,
    );

    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Tracking: Region: East");
  });
});

describe("formatQuoteLineItems", () => {
  it("returns null when there are no line items", () => {
    expect(formatQuoteLineItems(undefined)).toBeNull();
    expect(formatQuoteLineItems([])).toBeNull();
  });

  it("numbers each line so they stay separate", () => {
    const text = formatQuoteLineItems(lineItems);

    expect(text).toContain("Line Items (2):");
    expect(text).toContain("1.");
    expect(text).toContain("2.");
    expect(text).toContain("Travel expenses");
  });
});

describe("formatQuote", () => {
  it("includes header fields and every line item", () => {
    const quote: Quote = {
      quoteID: "q-1",
      quoteNumber: "QU-0007",
      contact: { contactID: "c-1", name: "ABC Limited" },
      total: 600,
      lineItems,
    };

    const text = formatQuote(quote);

    expect(text).toContain("Quote ID: q-1");
    expect(text).toContain("Quote Number: QU-0007");
    expect(text).toContain("Contact: ABC Limited (c-1)");
    expect(text).toContain("Half day training - Microsoft Office");
    expect(text).toContain("Travel expenses");
  });
});
