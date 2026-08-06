import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("../handlers/create-xero-invoice.handler.js", () => ({
  createXeroInvoice: vi.fn(),
}));

vi.mock("../handlers/update-xero-invoice.handler.js", () => ({
  updateXeroInvoice: vi.fn(),
}));

vi.mock("../helpers/get-deeplink.js", () => ({
  DeepLinkType: {
    INVOICE: "INVOICE",
    BILL: "BILL",
  },
  getDeepLink: vi.fn(),
}));

import CreateInvoiceTool from "./create/create-invoice.tool.js";
import UpdateInvoiceTool from "./update/update-invoice.tool.js";

const lineItemWithNameBasedTracking = {
  description: "Consulting services",
  quantity: 1,
  unitAmount: 100,
  accountCode: "200",
  taxType: "OUTPUT",
  tracking: [{ name: "Region", option: "South" }],
};

describe("invoice tracking validation", () => {
  it("allows name-and-option tracking for invoice creation", () => {
    const schema = z.object(CreateInvoiceTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      contactId: "contact-id",
      type: "ACCREC",
      lineItems: [lineItemWithNameBasedTracking],
    }).success).toBe(true);
  });

  it("allows name-and-option tracking for invoice updates", () => {
    const schema = z.object(UpdateInvoiceTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      invoiceId: "invoice-id",
      lineItems: [lineItemWithNameBasedTracking],
    }).success).toBe(true);
  });
});
