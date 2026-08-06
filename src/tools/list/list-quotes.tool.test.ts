import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroQuotes: vi.fn(),
}));

vi.mock("../../handlers/list-xero-quotes.handler.js", () => ({
  listXeroQuotes: mocks.listXeroQuotes,
}));

import ListQuotesTool from "./list-quotes.tool.js";

describe("list-quotes tool", () => {
  const tool = ListQuotesTool();

  it("shows editable line details when a quote number is requested", async () => {
    mocks.listXeroQuotes.mockResolvedValue({
      result: [{
        quoteID: "quote-id",
        quoteNumber: "QU-0001",
        lineItems: [{
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

    const result = await tool.handler({ page: 1, quoteNumber: "QU-0001" }, {} as never);
    const quoteText = result.content
      .filter((content) => content.type === "text")
      .map((content) => content.text)
      .find((text) => text.includes("Quote ID: quote-id"));

    expect(mocks.listXeroQuotes).toHaveBeenCalledWith(1, undefined, "QU-0001");
    expect(quoteText).toContain("Line Item ID: line-item-id");
    expect(quoteText).toContain("Item ID: item-id");
    expect(quoteText).toContain("Quantity: 0");
    expect(quoteText).toContain("Unit Amount: 0");
    expect(quoteText).toContain("Tax Amount: 0");
    expect(quoteText).toContain("Discount Rate: 0");
    expect(quoteText).toContain("Tracking: Region=West");
    expect(quoteText).toContain("Tracking Category ID: tracking-category-id");
    expect(quoteText).toContain("Tracking Option ID: tracking-option-id");
    expect(quoteText).not.toContain("[object Object]");
  });

  it("keeps broad quote listings compact", async () => {
    mocks.listXeroQuotes.mockResolvedValue({
      result: [{
        quoteID: "quote-id",
        quoteNumber: "QU-0001",
        lineItems: [{ lineItemID: "line-item-id" }],
      }],
      isError: false,
      error: null,
    });

    const result = await tool.handler({ page: 1 }, {} as never);
    const quoteText = result.content
      .filter((content) => content.type === "text")
      .map((content) => content.text)
      .find((text) => text.includes("Quote ID: quote-id"));

    expect(quoteText).not.toContain("Line Item ID: line-item-id");
  });
});
