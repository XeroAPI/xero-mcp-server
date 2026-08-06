import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createQuotes: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createQuotes: mocks.createQuotes,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { createXeroQuote } from "../create-xero-quote.handler.js";

describe("createXeroQuote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createQuotes.mockResolvedValue({
      body: { quotes: [{ quoteID: "quote-id" }] },
    });
  });

  it("sends quote discounts and tracking option IDs", async () => {
    const result = await createXeroQuote("contact-id", [{
      description: "Consulting services",
      tracking: [{ trackingOptionID: "tracking-option-id" }],
      discountRate: 10,
      discountAmount: 5,
    }]);

    expect(result.isError).toBe(false);
    expect(mocks.createQuotes.mock.calls[0][1].quotes[0].lineItems).toEqual([
      expect.objectContaining({
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      }),
    ]);
  });

  it("forwards an idempotency key for safe retries", async () => {
    const result = await createXeroQuote(
      "contact-id",
      [{ description: "Consulting services" }],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "quote-retry-key",
    );

    expect(result.isError).toBe(false);
    expect(mocks.createQuotes.mock.calls[0][3]).toBe("quote-retry-key");
  });

  it("rejects account-coded quote lines without a tax type", async () => {
    const result = await createXeroQuote("contact-id", [{
      description: "Consulting services",
      accountCode: "200",
    }]);

    expect(result).toMatchObject({
      isError: true,
      error: "A quote line with an account code requires a tax type.",
    });
    expect(mocks.createQuotes).not.toHaveBeenCalled();
  });
});
