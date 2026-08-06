import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { Invoice } from "xero-node";

const mocks = vi.hoisted(() => ({
  createXeroInvoice: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-invoice.handler.js", () => ({
  createXeroInvoice: mocks.createXeroInvoice,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: {
    INVOICE: "INVOICE",
    BILL: "BILL",
  },
  getDeepLink: mocks.getDeepLink,
}));

import CreateInvoiceTool from "./create-invoice.tool.js";

describe("create-invoice tool", () => {
  const tool = CreateInvoiceTool();
  const schema = z.object(tool.schema as z.ZodRawShape);

  it("accepts description-only and item-code-only line items", () => {
    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{ description: "Consulting services" }],
    }).success).toBe(true);

    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{ itemCode: "CONSULT" }],
    }).success).toBe(true);
  });

  it("requires a non-empty list of identified line items", () => {
    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [],
    }).success).toBe(false);

    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{}],
    }).success).toBe(false);

    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{ description: "Consulting services" }],
      idempotencyKey: "x".repeat(129),
    }).success).toBe(false);
  });

  it("defaults omitted invoice types to ACCREC", async () => {
    mocks.createXeroInvoice.mockResolvedValue({
      result: {
        invoiceID: "invoice-id",
        type: Invoice.TypeEnum.ACCREC,
        contact: { name: "Example contact" },
      },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await tool.handler({
      contactId: "contact-id",
      lineItems: [{ description: "Consulting services" }],
    }, {} as never);

    expect(mocks.createXeroInvoice).toHaveBeenCalledWith(
      "contact-id",
      [{ description: "Consulting services" }],
      Invoice.TypeEnum.ACCREC,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it("forwards a supplied due date and safe initial status", async () => {
    mocks.createXeroInvoice.mockResolvedValue({
      result: {
        invoiceID: "invoice-id",
        type: Invoice.TypeEnum.ACCREC,
        contact: { name: "Example contact" },
        dueDate: "2026-08-31",
        status: Invoice.StatusEnum.AUTHORISED,
      },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    const result = await tool.handler({
      contactId: "contact-id",
      lineItems: [{ description: "Consulting services" }],
      dueDate: "2026-08-31",
      status: "AUTHORISED",
    }, {} as never);

    expect(mocks.createXeroInvoice).toHaveBeenCalledWith(
      "contact-id",
      [{ description: "Consulting services" }],
      Invoice.TypeEnum.ACCREC,
      undefined,
      undefined,
      undefined,
      "2026-08-31",
      Invoice.StatusEnum.AUTHORISED,
    );
    const responseText = result.content.find((content) => content.type === "text")?.text;
    expect(responseText).toContain("Due Date: 2026-08-31");
  });

  it("forwards sales invoice discounts", async () => {
    mocks.createXeroInvoice.mockResolvedValue({
      result: { invoiceID: "invoice-id", type: Invoice.TypeEnum.ACCREC },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await tool.handler({
      contactId: "contact-id",
      lineItems: [{
        description: "Consulting services",
        discountRate: 10,
        discountAmount: 5,
      }],
    }, {} as never);

    expect(mocks.createXeroInvoice).toHaveBeenCalledWith(
      "contact-id",
      [expect.objectContaining({ discountRate: 10, discountAmount: 5 })],
      Invoice.TypeEnum.ACCREC,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });
});
