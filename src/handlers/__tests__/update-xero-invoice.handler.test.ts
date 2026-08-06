import { beforeEach, describe, expect, it, vi } from "vitest";
import { Invoice, LineAmountTypes } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getInvoice: vi.fn(),
  updateInvoice: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getInvoice: mocks.getInvoice,
      updateInvoice: mocks.updateInvoice,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { updateXeroInvoice } from "../update-xero-invoice.handler.js";

describe("updateXeroInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateInvoice.mockResolvedValue({
      body: { invoices: [{ invoiceID: "invoice-id" }] },
    });
  });

  it("preserves an inclusive sales invoice's tax basis and line discounts", async () => {
    mocks.getInvoice.mockResolvedValue({
      body: {
        invoices: [{
          status: Invoice.StatusEnum.DRAFT,
          type: Invoice.TypeEnum.ACCREC,
          lineAmountTypes: LineAmountTypes.Inclusive,
        }],
      },
    });

    const result = await updateXeroInvoice("invoice-id", [{
      lineItemID: "line-item-id",
      description: "Consulting services",
      quantity: 1,
      unitAmount: 100,
      accountCode: "200",
      taxType: "OUTPUT",
      discountRate: 10,
      discountAmount: 5,
    }]);

    expect(result.isError).toBe(false);
    expect(mocks.updateInvoice.mock.calls[0][2].invoices[0]).toMatchObject({
      lineAmountTypes: LineAmountTypes.Inclusive,
      lineItems: [expect.objectContaining({
        lineItemID: "line-item-id",
        discountRate: 10,
        discountAmount: 5,
      })],
    });
  });

  it("rejects line discounts on ACCPAY bills", async () => {
    mocks.getInvoice.mockResolvedValue({
      body: {
        invoices: [{
          status: Invoice.StatusEnum.DRAFT,
          type: Invoice.TypeEnum.ACCPAY,
        }],
      },
    });

    const result = await updateXeroInvoice("invoice-id", [{
      description: "Office supplies",
      quantity: 1,
      unitAmount: 100,
      accountCode: "400",
      taxType: "INPUT",
      discountRate: 10,
    }]);

    expect(result).toMatchObject({
      isError: true,
      error: "Line discounts are only supported on ACCREC sales invoices.",
    });
    expect(mocks.updateInvoice).not.toHaveBeenCalled();
  });
});
