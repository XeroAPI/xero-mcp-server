import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createXeroQuote: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-quote.handler.js", () => ({
  createXeroQuote: mocks.createXeroQuote,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { QUOTE: "QUOTE" },
  getDeepLink: mocks.getDeepLink,
}));

import CreateQuoteTool from "./create-quote.tool.js";

describe("create-quote tool", () => {
  it("forwards quote discounts and tracking option IDs", async () => {
    mocks.createXeroQuote.mockResolvedValue({
      result: { quoteID: "quote-id" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await CreateQuoteTool().handler({
      contactId: "contact-id",
      lineItems: [{
        description: "Consulting services",
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      }],
    }, {} as never);

    expect(mocks.createXeroQuote).toHaveBeenCalledWith(
      "contact-id",
      [expect.objectContaining({
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      })],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });
});
