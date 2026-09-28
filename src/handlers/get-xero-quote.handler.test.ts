import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { getXeroQuote } from "./get-xero-quote.handler.js";

const quote = {
  quoteID: "q-1",
  quoteNumber: "QU-0007",
  lineItems: [{ description: "Training", quantity: 1, unitAmount: 500 }],
};

describe("getXeroQuote", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("fetches a quote by ID", async () => {
    mockAccountingApi.getQuote.mockResolvedValue({
      body: { quotes: [quote] },
    });

    const result = await getXeroQuote({ quoteId: "q-1" });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(quote);
    expect(mockXeroClient.authenticate).toHaveBeenCalledOnce();
    expect(mockAccountingApi.getQuote).toHaveBeenCalledWith(
      "tenant-1",
      "q-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
    expect(mockAccountingApi.getQuotes).not.toHaveBeenCalled();
  });

  it("fetches a quote by number when no ID is given", async () => {
    mockAccountingApi.getQuotes.mockResolvedValue({
      body: { quotes: [quote] },
    });

    const result = await getXeroQuote({ quoteNumber: "QU-0007" });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(quote);
    expect(mockAccountingApi.getQuotes).toHaveBeenCalledWith(
      "tenant-1",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      undefined,
      "QU-0007",
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("returns only a quote whose number matches exactly", async () => {
    mockAccountingApi.getQuotes.mockResolvedValue({
      body: {
        quotes: [{ ...quote, quoteID: "q-70", quoteNumber: "QU-00070" }, quote],
      },
    });

    const result = await getXeroQuote({ quoteNumber: "QU-0007" });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.quoteID).toBe("q-1");
  });

  it("reports a missing quote when no number matches exactly", async () => {
    mockAccountingApi.getQuotes.mockResolvedValue({
      body: { quotes: [{ ...quote, quoteNumber: "QU-00070" }] },
    });

    const result = await getXeroQuote({ quoteNumber: "QU-0007" });

    expect(result.isError).toBe(true);
  });

  it("prefers quote ID when both identifiers are provided", async () => {
    mockAccountingApi.getQuote.mockResolvedValue({
      body: { quotes: [quote] },
    });

    await getXeroQuote({ quoteId: "q-1", quoteNumber: "QU-0007" });

    expect(mockAccountingApi.getQuote).toHaveBeenCalledOnce();
    expect(mockAccountingApi.getQuotes).not.toHaveBeenCalled();
  });

  it("returns an error when neither identifier is provided", async () => {
    const result = await getXeroQuote({});

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Provide a quoteId or quoteNumber.",
    });
    expect(mockAccountingApi.getQuote).not.toHaveBeenCalled();
    expect(mockAccountingApi.getQuotes).not.toHaveBeenCalled();
  });

  it("returns an error when Xero omits the quote", async () => {
    mockAccountingApi.getQuote.mockResolvedValue({ body: { quotes: [] } });

    const result = await getXeroQuote({ quoteId: "missing" });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Quote not found.",
    });
  });

  it("returns a formatted error when the get call fails", async () => {
    mockAccountingApi.getQuote.mockRejectedValue(new Error("not authorised"));

    const result = await getXeroQuote({ quoteId: "q-1" });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "not authorised",
    });
  });
});
