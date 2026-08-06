import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroCreditNotes: vi.fn(),
}));

vi.mock("../../handlers/list-xero-credit-notes.handler.js", () => ({
  listXeroCreditNotes: mocks.listXeroCreditNotes,
}));

import ListCreditNotesTool from "./list-credit-notes.tool.js";

describe("list-credit-notes", () => {
  it("renders complete line-item accounting details", async () => {
    mocks.listXeroCreditNotes.mockResolvedValue({
      result: [{
        creditNoteID: "credit-note-id",
        creditNoteNumber: "CN-001",
        lineItems: [{
          lineItemID: "line-item-id",
          item: { itemID: "item-id" },
          itemCode: "RETURN",
          description: "Returned goods",
          quantity: 0,
          unitAmount: 0,
          accountCode: "200",
          taxType: "OUTPUT",
          taxAmount: 0,
          tracking: [{
            name: "Region",
            option: "West",
            trackingCategoryID: "tracking-category-id",
            trackingOptionID: "tracking-option-id",
          }],
          lineAmount: 0,
        }],
      }],
      isError: false,
      error: null,
    });

    const result = await ListCreditNotesTool().handler(
      { page: 1 },
      {} as never,
    );
    const creditNoteText = result.content
      .filter((content) => content.type === "text")
      .map((content) => content.text)
      .find((text) => text.includes("Credit Note ID: credit-note-id"));

    expect(mocks.listXeroCreditNotes).toHaveBeenCalledWith(1, undefined);
    expect(creditNoteText).toContain("Line Item ID: line-item-id");
    expect(creditNoteText).toContain("Item ID: item-id");
    expect(creditNoteText).toContain("Quantity: 0");
    expect(creditNoteText).toContain("Unit Amount: 0");
    expect(creditNoteText).toContain("Tax Amount: 0");
    expect(creditNoteText).toContain("Line Amount: 0");
    expect(creditNoteText).toContain("Tracking: Region=West");
    expect(creditNoteText).toContain("Tracking Category ID: tracking-category-id");
    expect(creditNoteText).toContain("Tracking Option ID: tracking-option-id");
    expect(creditNoteText).not.toContain("[object Object]");
  });

  it("requires a UUID contact filter", () => {
    const schema = z.object(ListCreditNotesTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      page: 1,
      contactId: "123e4567-e89b-12d3-a456-426614174000",
    }).success).toBe(true);
    expect(schema.safeParse({
      page: 1,
      contactId: 'contact-id") OR Status=="AUTHORISED',
    }).success).toBe(false);
  });
});
