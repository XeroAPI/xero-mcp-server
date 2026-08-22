import { describe, expect, it, vi } from "vitest";
import CreateInvoiceTool from "../create/create-invoice.tool.js";
import UpdateInvoiceTool from "../update/update-invoice.tool.js";

vi.mock("../../handlers/create-xero-invoice.handler.js", () => ({
  createXeroInvoice: vi.fn(),
}));

vi.mock("../../handlers/update-xero-invoice.handler.js", () => ({
  updateXeroInvoice: vi.fn(),
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { INVOICE: "INVOICE", BILL: "BILL" },
  getDeepLink: vi.fn(),
}));

type LineItemsSchema = {
  safeParse(value: unknown): {
    success: boolean;
    data?: Array<{ discountRate?: number; discountAmount?: number }>;
  };
};

const requiredLineItem = {
  description: "Consulting services",
  quantity: 1,
  unitAmount: 120,
  accountCode: "200",
  taxType: "OUTPUT",
};

describe.each([
  ["create-invoice", CreateInvoiceTool],
  ["update-invoice", UpdateInvoiceTool],
])("%s discount fields", (_name, toolFactory) => {
  const schema = toolFactory().schema.lineItems as LineItemsSchema;

  it("accepts a discount rate", () => {
    const result = schema.safeParse([{ ...requiredLineItem, discountRate: 12.5 }]);

    expect(result.success).toBe(true);
    expect(result.data?.[0].discountRate).toBe(12.5);
  });

  it("accepts a fixed discount amount", () => {
    const result = schema.safeParse([{ ...requiredLineItem, discountAmount: 15 }]);

    expect(result.success).toBe(true);
    expect(result.data?.[0].discountAmount).toBe(15);
  });

  it("rejects using both discount forms on the same line", () => {
    const result = schema.safeParse([
      { ...requiredLineItem, discountRate: 10, discountAmount: 15 },
    ]);

    expect(result.success).toBe(false);
  });
});
