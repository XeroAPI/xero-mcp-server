import { describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";
import { createXeroInvoice } from "../../../handlers/create-xero-invoice.handler.js";
import CreateInvoiceTool from "../create-invoice.tool.js";

vi.mock("../../../handlers/create-xero-invoice.handler.js", () => ({
  createXeroInvoice: vi.fn(),
}));

vi.mock("../../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { INVOICE: "INVOICE", BILL: "BILL" },
  getDeepLink: vi.fn().mockResolvedValue(null),
}));

describe("CreateInvoiceTool", () => {
  it("returns the invoice number after creating an invoice", async () => {
    vi.mocked(createXeroInvoice).mockResolvedValue({
      result: {
        invoiceID: "invoice-id",
        invoiceNumber: "INV-0042",
        type: Invoice.TypeEnum.ACCREC,
      },
      isError: false,
      error: null,
    });

    const result = await CreateInvoiceTool().handler(
      {
        contactId: "contact-id",
        lineItems: [
          {
            description: "Consulting services",
            quantity: 1,
            unitAmount: 120,
            accountCode: "200",
            taxType: "OUTPUT",
          },
        ],
        type: "ACCREC",
      },
      {} as never,
    );

    expect(result.content?.[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Invoice Number: INV-0042"),
    });
  });
});
