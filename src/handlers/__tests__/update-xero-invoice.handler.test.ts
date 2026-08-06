import { beforeEach, describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";

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

  it("maps a bill reference to invoiceNumber", async () => {
    mocks.getInvoice.mockResolvedValue({
      body: {
        invoices: [{
          type: Invoice.TypeEnum.ACCPAY,
          status: Invoice.StatusEnum.DRAFT,
        }],
      },
    });

    await updateXeroInvoice("invoice-id", undefined, "BILL-REF-001");

    const payload = mocks.updateInvoice.mock.calls[0][2];
    expect(payload.invoices[0]).toMatchObject({ invoiceNumber: "BILL-REF-001" });
    expect(payload.invoices[0]).not.toHaveProperty("reference");
  });

  it("keeps the reference field for sales invoices", async () => {
    mocks.getInvoice.mockResolvedValue({
      body: {
        invoices: [{
          type: Invoice.TypeEnum.ACCREC,
          status: Invoice.StatusEnum.DRAFT,
        }],
      },
    });

    await updateXeroInvoice("invoice-id", undefined, "SALES-REF-001");

    const payload = mocks.updateInvoice.mock.calls[0][2];
    expect(payload.invoices[0]).toMatchObject({ reference: "SALES-REF-001" });
    expect(payload.invoices[0]).not.toHaveProperty("invoiceNumber");
  });
});
