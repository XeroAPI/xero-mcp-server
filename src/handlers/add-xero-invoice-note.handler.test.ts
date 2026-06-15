import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateMock = vi.fn();
const createInvoiceHistoryMock = vi.fn();
const getClientHeadersMock = vi.fn(() => ({ "x-test": "header" }));

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-123",
    authenticate: authenticateMock,
    accountingApi: {
      createInvoiceHistory: createInvoiceHistoryMock,
    },
  },
}));

vi.mock("../helpers/get-client-headers.js", () => ({
  getClientHeaders: getClientHeadersMock,
}));

describe("addXeroInvoiceNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an invoice history record with the provided note", async () => {
    createInvoiceHistoryMock.mockResolvedValue({
      body: {
        historyRecords: [{ details: "Audit note" }],
      },
    });

    const { addXeroInvoiceNote } = await import("./add-xero-invoice-note.handler.js");

    const result = await addXeroInvoiceNote("invoice-1", "Audit note");

    expect(result.isError).toBe(false);
    expect(result.result).toBe("Audit note");
    expect(createInvoiceHistoryMock).toHaveBeenCalledWith(
      "tenant-123",
      "invoice-1",
      {
        historyRecords: [{ details: "Audit note" }],
      },
      undefined,
      { "x-test": "header" },
    );
  });
});
