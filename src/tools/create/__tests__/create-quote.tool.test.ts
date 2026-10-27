import { describe, expect, it, vi } from "vitest";
import CreateQuoteTool from "../create-quote.tool.js";

vi.mock("../../../handlers/create-xero-quote.handler.js", () => ({
  createXeroQuote: vi.fn(),
}));

vi.mock("../../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { QUOTE: "QUOTE" },
  getDeepLink: vi.fn(),
}));

describe("CreateQuoteTool", () => {
  it("accepts and preserves an item code on line items", () => {
    const lineItemsSchema = CreateQuoteTool().schema.lineItems as {
      parse(value: unknown): Array<{ itemCode?: string }>;
    };
    const lineItems = lineItemsSchema.parse([
      {
        itemCode: "CONSULTING",
        description: "Consulting services",
        quantity: 1,
        unitAmount: 120,
        accountCode: "200",
        taxType: "OUTPUT",
      },
    ]);

    expect(lineItems[0].itemCode).toBe("CONSULTING");
  });
});
