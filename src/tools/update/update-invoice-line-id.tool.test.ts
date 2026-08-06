import { describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";

const mocks = vi.hoisted(() => ({
  updateXeroInvoice: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/update-xero-invoice.handler.js", () => ({
  updateXeroInvoice: mocks.updateXeroInvoice,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: {
    INVOICE: "INVOICE",
    BILL: "BILL",
  },
  getDeepLink: mocks.getDeepLink,
}));

import UpdateInvoiceTool from "./update-invoice.tool.js";

describe("update-invoice line item IDs", () => {
  it("maps the tool's lineItemId to Xero's lineItemID", async () => {
    mocks.updateXeroInvoice.mockResolvedValue({
      result: { invoiceID: "invoice-id", type: Invoice.TypeEnum.ACCREC },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await UpdateInvoiceTool().handler({
      invoiceId: "invoice-id",
      lineItems: [{
        lineItemId: "line-item-id",
        description: "Consulting services",
        quantity: 1,
        unitAmount: 100,
        accountCode: "200",
        taxType: "OUTPUT",
        discountRate: 10,
        discountAmount: 5,
      }],
    }, {} as never);

    expect(mocks.updateXeroInvoice).toHaveBeenCalledWith(
      "invoice-id",
      [expect.objectContaining({
        lineItemID: "line-item-id",
        description: "Consulting services",
        discountRate: 10,
        discountAmount: 5,
      })],
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(mocks.updateXeroInvoice.mock.calls[0]?.[1][0]).not.toHaveProperty("lineItemId");
  });
});
