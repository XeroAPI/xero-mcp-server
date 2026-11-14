import { describe, expect, it, vi } from "vitest";
import UpdateInvoiceTool from "../update/update-invoice.tool.js";

vi.mock("../../handlers/update-xero-invoice.handler.js", () => ({
  updateXeroInvoice: vi.fn(),
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { INVOICE: "INVOICE", BILL: "BILL" },
  getDeepLink: vi.fn(),
}));

type LineItemsSchema = {
  safeParse(value: unknown): { success: boolean };
};

describe("invoice line item IDs", () => {
  const schema = UpdateInvoiceTool().schema.lineItems as LineItemsSchema;

  it("accepts a targeted partial update when lineItemID is present", () => {
    expect(
      schema.safeParse([{ lineItemID: "line-item-id", quantity: 2 }]).success,
    ).toBe(true);
  });

  it("rejects partial line data without lineItemID", () => {
    expect(schema.safeParse([{ quantity: 2 }]).success).toBe(false);
  });

  it("rejects an empty targeted update", () => {
    expect(schema.safeParse([{ lineItemID: "line-item-id" }]).success).toBe(
      false,
    );
  });
});
