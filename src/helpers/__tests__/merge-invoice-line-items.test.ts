import { describe, expect, it } from "vitest";
import { mergeInvoiceLineItems } from "../merge-invoice-line-items.js";

describe("mergeInvoiceLineItems", () => {
  const existingLineItems = [
    {
      lineItemID: "first-line",
      description: "First line",
      quantity: 1,
      unitAmount: 12.5,
      accountCode: "200",
    },
    {
      lineItemID: "second-line",
      description: "Second line",
      quantity: 3,
      unitAmount: 7,
      accountCode: "200",
    },
  ];

  it("preserves untouched lines during a targeted update", () => {
    expect(
      mergeInvoiceLineItems(existingLineItems, [
        { lineItemID: "first-line", quantity: 2 },
      ]),
    ).toEqual([
      { lineItemID: "first-line", quantity: 2 },
      existingLineItems[1],
    ]);
  });

  it("appends new complete lines while preserving existing lines", () => {
    const newLineItem = {
      description: "New line",
      quantity: 1,
      unitAmount: 4,
      accountCode: "200",
      taxType: "OUTPUT",
    };

    expect(
      mergeInvoiceLineItems(existingLineItems, [
        { lineItemID: "first-line", quantity: 2 },
        newLineItem,
      ]),
    ).toEqual([
      { lineItemID: "first-line", quantity: 2 },
      existingLineItems[1],
      newLineItem,
    ]);
  });

  it("retains replacement behavior when no line item IDs are supplied", () => {
    const replacement = [
      {
        description: "Replacement",
        quantity: 1,
        unitAmount: 5,
        accountCode: "200",
        taxType: "OUTPUT",
      },
    ];

    expect(mergeInvoiceLineItems(existingLineItems, replacement)).toEqual(
      replacement,
    );
  });

  it("rejects a targeted update for a line that is not on the invoice", () => {
    expect(() =>
      mergeInvoiceLineItems(existingLineItems, [
        { lineItemID: "missing-line", quantity: 2 },
      ]),
    ).toThrow("Cannot update line item missing-line");
  });

  it("rejects duplicate targeted updates", () => {
    expect(() =>
      mergeInvoiceLineItems(existingLineItems, [
        { lineItemID: "first-line", quantity: 2 },
        { lineItemID: "first-line", quantity: 3 },
      ]),
    ).toThrow("Duplicate lineItemID: first-line");
  });
});
