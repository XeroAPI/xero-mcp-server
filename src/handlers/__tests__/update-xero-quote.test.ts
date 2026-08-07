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
        })],
      },
      undefined,
      expect.any(Object),
    );
  });

  it("sends an allowed quote status transition", async () => {
    const result = await updateXeroQuote(
      "quote-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "ACCEPTED",
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateQuote).toHaveBeenCalledWith(
      "tenant-id",
      "quote-id",
      { quotes: [{ status: QuoteStatusCodes.ACCEPTED }] },
      undefined,
      expect.any(Object),
    );
  });

  it("allows accepted quotes to transition to invoiced", async () => {
    mocks.getQuote.mockResolvedValue({
      body: { quotes: [{ status: QuoteStatusCodes.ACCEPTED }] },
    });

    const result = await updateXeroQuote(
      "quote-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "INVOICED",
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateQuote).toHaveBeenCalledWith(
      "tenant-id",
      "quote-id",
      {
        quotes: [expect.objectContaining({ status: QuoteStatusCodes.INVOICED })],
      },
      undefined,
      expect.any(Object),
    );
  });

  it("allows contact changes to accepted quotes", async () => {
    mocks.getQuote.mockResolvedValue({
      body: { quotes: [{ status: QuoteStatusCodes.ACCEPTED }] },
    });

    const result = await updateXeroQuote(
      "quote-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "updated-contact-id",
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateQuote).toHaveBeenCalledWith(
      "tenant-id",
      "quote-id",
      { quotes: [{ contact: { contactID: "updated-contact-id" } }] },
      undefined,
      expect.any(Object),
    );
  });

  it("rejects contact-only changes to deleted quotes", async () => {
    mocks.getQuote.mockResolvedValue({
      body: { quotes: [{ status: QuoteStatusCodes.DELETED }] },
    });

    const result = await updateXeroQuote(
      "quote-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "updated-contact-id",
    );

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Cannot update quote because it is neither editable nor eligible for the requested status transition. Current status: DELETED",
    });
    expect(mocks.updateQuote).not.toHaveBeenCalled();
  });

  it("rejects field changes alongside a transition from a non-editable quote", async () => {
    mocks.getQuote.mockResolvedValue({
      body: { quotes: [{ status: QuoteStatusCodes.ACCEPTED }] },
    });

    const result = await updateXeroQuote(
      "quote-id",
      undefined,
      "updated-reference",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "INVOICED",
    );

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Cannot update quote fields in this status. Current status: ACCEPTED",
    });
    expect(mocks.updateQuote).not.toHaveBeenCalled();
  });

  it("rejects an invalid status transition before calling Xero", async () => {
    mocks.getQuote.mockResolvedValue({
      body: { quotes: [{ status: QuoteStatusCodes.DRAFT }] },
    });

    const result = await updateXeroQuote(
      "quote-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "ACCEPTED",
    );

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Cannot update quote because it is neither editable nor eligible for the requested status transition. Current status: DRAFT",
    });
    expect(mocks.updateQuote).not.toHaveBeenCalled();
  });
});
