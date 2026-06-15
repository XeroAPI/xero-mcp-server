import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyCode, Invoice } from "xero-node";

const authenticateMock = vi.fn();
const createInvoicesMock = vi.fn();
const getClientHeadersMock = vi.fn(() => ({ "x-test": "header" }));

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-123",
    authenticate: authenticateMock,
    accountingApi: {
      createInvoices: createInvoicesMock,
    },
  },
}));

vi.mock("../helpers/get-client-headers.js", () => ({
  getClientHeaders: getClientHeadersMock,
}));

describe("createXeroInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes currencyCode and currencyRate through to the created invoice", async () => {
    createInvoicesMock.mockResolvedValue({
      body: {
        invoices: [{ invoiceID: "inv-1", currencyCode: "EUR", currencyRate: 1.67 }],
      },
    });

    const { createXeroInvoice } = await import("./create-xero-invoice.handler.js");

    const result = await createXeroInvoice(
      "contact-1",
      [
        {
          description: "Consulting",
          quantity: 1,
          unitAmount: 120,
          accountCode: "200",
          taxType: "NONE",
        },
      ],
      Invoice.TypeEnum.ACCPAY,
      "BILL-001",
      "2026-06-15",
      "EUR" as unknown as CurrencyCode,
      1.67,
    );

    expect(result.isError).toBe(false);
    expect(createInvoicesMock).toHaveBeenCalledWith(
      "tenant-123",
      {
        invoices: [
          expect.objectContaining({
            currencyCode: "EUR",
            currencyRate: 1.67,
          }),
        ],
      },
      true,
      undefined,
      undefined,
      { "x-test": "header" },
    );
  });
});
