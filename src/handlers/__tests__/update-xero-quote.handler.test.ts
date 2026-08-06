import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteLineAmountTypes, QuoteStatusCodes } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getQuote: vi.fn(),
  updateQuote: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getQuote: mocks.getQuote,
      updateQuote: mocks.updateQuote,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { updateXeroQuote } from "../update-xero-quote.handler.js";

describe("updateXeroQuote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuote.mockResolvedValue({
      body: { quotes: [{
        status: QuoteStatusCodes.DRAFT,
        lineAmountTypes: QuoteLineAmountTypes.INCLUSIVE,
      }] },
    });
    mocks.updateQuote.mockResolvedValue({
      body: { quotes: [{ quoteID: "quote-id" }] },
    });
  });

  it("keeps existing line identities and editable quote-line fields", async () => {
    const result = await updateXeroQuote("quote-id", [{
      lineItemID: "line-item-id",
      description: "Consulting services",
      quantity: 1,
      unitAmount: 100,
      itemCode: "CONSULT",
      accountCode: "200",
      taxType: "OUTPUT",
      tracking: [{ trackingOptionID: "tracking-option-id" }],
      discountRate: 10,
      discountAmount: 5,
    }]);

    expect(result.isError).toBe(false);
    expect(mocks.updateQuote.mock.calls[0][2].quotes[0].lineItems).toEqual([
      expect.objectContaining({
        lineItemID: "line-item-id",
        itemCode: "CONSULT",
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      }),
    ]);
    expect(mocks.updateQuote.mock.calls[0][2].quotes[0]).toMatchObject({
      lineAmountTypes: QuoteLineAmountTypes.INCLUSIVE,
    });
  });

  it("does not invent a line amount type when the existing quote has none", async () => {
    mocks.getQuote.mockResolvedValue({
      body: { quotes: [{ status: QuoteStatusCodes.DRAFT }] },
    });

    const result = await updateXeroQuote("quote-id", undefined, "Updated reference");

    expect(result.isError).toBe(false);
    expect(mocks.updateQuote.mock.calls[0][2].quotes[0]).not.toHaveProperty("lineAmountTypes");
  });
});
