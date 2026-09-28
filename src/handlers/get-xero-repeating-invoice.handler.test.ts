import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { getXeroRepeatingInvoice } from "./get-xero-repeating-invoice.handler.js";

const repeatingInvoice = {
  repeatingInvoiceID: "ri-1",
  status: "DRAFT",
  lineItems: [{ description: "Retainer", quantity: 1, unitAmount: 500 }],
};

describe("getXeroRepeatingInvoice", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("retrieves a repeating invoice by ID", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [repeatingInvoice] },
    });

    const result = await getXeroRepeatingInvoice("ri-1");

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.repeatingInvoiceID).toBe("ri-1");
    expect(mockAccountingApi.getRepeatingInvoice).toHaveBeenCalledWith(
      "tenant-1",
      "ri-1",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("returns an error when Xero returns no repeating invoice", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [] },
    });

    const result = await getXeroRepeatingInvoice("missing");

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Repeating invoice not found.",
    });
  });

  it("returns a formatted error when the get call fails", async () => {
    mockAccountingApi.getRepeatingInvoice.mockRejectedValue(
      new Error("not authorised"),
    );

    const result = await getXeroRepeatingInvoice("ri-1");

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "not authorised",
    });
  });
});
