import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyCode, Invoice } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createInvoices: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    authenticate: mocks.authenticate,
    tenantId: "tenant-id",
    accountingApi: {
      createInvoices: mocks.createInvoices,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: { "user-agent": "test" } }),
}));

import { createXeroInvoice } from "../create-xero-invoice.handler.js";

describe("createXeroInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createInvoices.mockResolvedValue({
      body: {
        invoices: [{ invoiceID: "invoice-id" }],
      },
    });
  });

  it("adds the requested currency code to the invoice payload", async () => {
    const result = await createXeroInvoice(
      "contact-id",
      [
        {
          description: "Consulting",
          quantity: 1,
          unitAmount: 100,
          accountCode: "200",
          taxType: "OUTPUT",
        },
      ],
      Invoice.TypeEnum.ACCREC,
      CurrencyCode.NZD,
      "reference",
      "2026-08-23",
    );

    expect(result.isError).toBe(false);
    expect(mocks.createInvoices).toHaveBeenCalledWith(
      "tenant-id",
      {
        invoices: [
          expect.objectContaining({
            currencyCode: CurrencyCode.NZD,
          }),
        ],
      },
      true,
      undefined,
      undefined,
      { headers: { "user-agent": "test" } },
    );
  });
});
