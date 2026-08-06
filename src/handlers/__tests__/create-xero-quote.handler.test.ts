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

import { createXeroQuote } from "../create-xero-quote.handler.js";

describe("createXeroQuote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createQuotes.mockResolvedValue({
      body: { quotes: [{ quoteID: "quote-id" }] },
    });
  });

  it("defers omitted dates to Xero", async () => {
    await createXeroQuote(
      "contact-id",
      [{ description: "Consulting", quantity: 1, unitAmount: 100, accountCode: "200", taxType: "OUTPUT" }],
    );

    const quote = mocks.createQuotes.mock.calls[0]?.[1].quotes[0];
    expect(quote).not.toHaveProperty("date");
    expect(quote).not.toHaveProperty("expiryDate");
  });

  it("preserves explicitly supplied dates", async () => {
    await createXeroQuote(
      "contact-id",
      [{ description: "Consulting", quantity: 1, unitAmount: 100, accountCode: "200", taxType: "OUTPUT" }],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "2026-08-06",
      "2026-08-20",
    );

    expect(mocks.createQuotes).toHaveBeenCalledWith(
      "tenant-id",
      {
        quotes: [expect.objectContaining({
          date: "2026-08-06",
          expiryDate: "2026-08-20",
        })],
      },
      true,
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
