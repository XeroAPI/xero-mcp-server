import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateMock = vi.fn();
const getInvoicesMock = vi.fn();
const getClientHeadersMock = vi.fn(() => ({ "x-test": "header" }));

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-123",
    authenticate: authenticateMock,
    accountingApi: {
      getInvoices: getInvoicesMock,
    },
  },
}));

vi.mock("../helpers/get-client-headers.js", () => ({
  getClientHeaders: getClientHeadersMock,
}));

describe("listXeroInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards statuses to the Xero invoices endpoint", async () => {
    const invoices = [{ invoiceID: "inv-1", status: "AUTHORISED" }];

    getInvoicesMock.mockResolvedValue({
      body: { invoices },
    });

    const { listXeroInvoices } = await import("./list-xero-invoices.handler.js");

    const result = await listXeroInvoices(
      2,
      ["contact-1"],
      ["INV-001"],
      ["AUTHORISED", "PAID"],
    );

    expect(result.isError).toBe(false);
    expect(result.result).toBe(invoices);
    expect(getInvoicesMock).toHaveBeenCalledWith(
      "tenant-123",
      undefined,
      undefined,
      "UpdatedDateUTC DESC",
      undefined,
      ["INV-001"],
      ["contact-1"],
      ["AUTHORISED", "PAID"],
      2,
      false,
      false,
      undefined,
      false,
      10,
      undefined,
      { "x-test": "header" },
    );
  });
});
