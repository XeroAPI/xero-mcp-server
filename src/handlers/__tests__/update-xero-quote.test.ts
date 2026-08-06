import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteStatusCodes } from "xero-node";

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

import { updateXeroQuote } from "../update-xero-quote.handler.js";

describe("updateXeroQuote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuote.mockResolvedValue({
      body: {
        quotes: [{
          status: QuoteStatusCodes.SENT,
          contact: {contactID: "contact-id"},
          date: "2026-08-06",
        }],
      },
    });
    mocks.updateQuote.mockResolvedValue({
      body: {quotes: [{quoteID: "quote-id", status: QuoteStatusCodes.SENT}]},
    });
  });

  it("allows updates to sent quotes", async () => {
    const result = await updateXeroQuote("quote-id", undefined, "updated-reference");

    expect(result).toMatchObject({
      isError: false,
      result: {quoteID: "quote-id", status: QuoteStatusCodes.SENT},
    });
    expect(mocks.updateQuote).toHaveBeenCalledWith(
      "tenant-id",
      "quote-id",
      {
        quotes: [expect.objectContaining({
          reference: "updated-reference",
          contact: {contactID: "contact-id"},
          date: "2026-08-06",
        })],
      },
      undefined,
      expect.any(Object),
    );
  });
});
