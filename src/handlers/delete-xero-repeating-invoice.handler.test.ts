import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { deleteXeroRepeatingInvoice } from "./delete-xero-repeating-invoice.handler.js";

const existing = {
  repeatingInvoiceID: "ri-1",
  status: "AUTHORISED",
};

describe("deleteXeroRepeatingInvoice", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("deletes a repeating invoice by setting status DELETED", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [existing] },
    });
    mockAccountingApi.updateRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [{ ...existing, status: "DELETED" }] },
    });

    const result = await deleteXeroRepeatingInvoice("ri-1");

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.status).toBe("DELETED");
    expect(mockAccountingApi.updateRepeatingInvoice).toHaveBeenCalledWith(
      "tenant-1",
      "ri-1",
      {
        repeatingInvoices: [{ status: "DELETED" }],
      },
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("rejects an already deleted repeating invoice", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [{ ...existing, status: "DELETED" }] },
    });

    const result = await deleteXeroRepeatingInvoice("ri-1");

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Repeating invoice is already deleted.",
    });
    expect(mockAccountingApi.updateRepeatingInvoice).not.toHaveBeenCalled();
  });

  it("returns an error when the repeating invoice cannot be loaded", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [] },
    });

    const result = await deleteXeroRepeatingInvoice("missing");

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Repeating invoice not found.",
    });
  });
});
