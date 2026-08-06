import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      undefined,
      undefined,
      undefined,
    );
    expect(mocks.updateXeroInvoice.mock.calls[0]?.[1][0]).not.toHaveProperty("lineItemId");
  });

  it("forwards and renders an expected payment date", async () => {
    mocks.updateXeroInvoice.mockResolvedValue({
      result: {
        invoiceID: "invoice-id",
        type: Invoice.TypeEnum.ACCREC,
        expectedPaymentDate: "2026-09-15",
      },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    const result = await UpdateInvoiceTool().handler({
      invoiceId: "invoice-id",
      expectedPaymentDate: "2026-09-15",
    }, {} as never);

    expect(mocks.updateXeroInvoice).toHaveBeenCalledWith(
      "invoice-id",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "2026-09-15",
      undefined,
      undefined,
    );
    const responseText = result.content.find((content) => content.type === "text")?.text;
    expect(responseText).toContain("Expected Payment Date: 2026-09-15");
  });

  it("forwards an idempotency key for safe retries", async () => {
    mocks.updateXeroInvoice.mockResolvedValue({
      result: { invoiceID: "invoice-id", type: Invoice.TypeEnum.ACCREC },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await UpdateInvoiceTool().handler({
      invoiceId: "invoice-id",
      reference: "Updated reference",
      idempotencyKey: "invoice-update-retry-key",
    }, {} as never);

    expect(mocks.updateXeroInvoice.mock.calls[0][8]).toBe("invoice-update-retry-key");
  });

  it("limits idempotency keys to Xero's supported length", () => {
    const schema = z.object(UpdateInvoiceTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      invoiceId: "invoice-id",
      idempotencyKey: "x".repeat(128),
    }).success).toBe(true);
    expect(schema.safeParse({
      invoiceId: "invoice-id",
      idempotencyKey: "x".repeat(129),
    }).success).toBe(false);
  });
});
