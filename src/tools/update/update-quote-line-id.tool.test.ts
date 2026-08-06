import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateXeroQuote: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/update-xero-quote.handler.js", () => ({
  updateXeroQuote: mocks.updateXeroQuote,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { QUOTE: "QUOTE" },
  getDeepLink: mocks.getDeepLink,
}));

import UpdateQuoteTool from "./update-quote.tool.js";

describe("update-quote line item IDs", () => {
  const tool = UpdateQuoteTool();

  it("requires Xero tracking option IDs for quote lines", () => {
    const schema = z.object(tool.schema as z.ZodRawShape);

    expect(schema.safeParse({
      quoteId: "quote-id",
      lineItems: [{
        description: "Consulting services",
        tracking: [{ name: "Region", option: "West" }],
      }],
    }).success).toBe(false);
    expect(schema.safeParse({
      quoteId: "quote-id",
      lineItems: [{
        description: "Consulting services",
        tracking: [{ trackingOptionID: "tracking-option-id" }],
      }],
    }).success).toBe(true);
  });

  it("maps the tool's lineItemId to Xero's lineItemID", async () => {
    mocks.updateXeroQuote.mockResolvedValue({
      result: { quoteID: "quote-id" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await tool.handler({
      quoteId: "quote-id",
      lineItems: [{
        lineItemId: "line-item-id",
        description: "Consulting services",
        quantity: 1,
        unitAmount: 100,
        itemCode: "CONSULT",
        accountCode: "200",
        taxType: "OUTPUT",
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      }],
    }, {} as never);

    expect(mocks.updateXeroQuote).toHaveBeenCalledWith(
      "quote-id",
      [expect.objectContaining({
        lineItemID: "line-item-id",
        description: "Consulting services",
        itemCode: "CONSULT",
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      })],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(mocks.updateXeroQuote.mock.calls[0]?.[1][0]).not.toHaveProperty("lineItemId");
  });
});
