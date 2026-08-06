import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("../handlers/create-xero-quote.handler.js", () => ({
  createXeroQuote: vi.fn(),
}));

vi.mock("../handlers/update-xero-quote.handler.js", () => ({
  updateXeroQuote: vi.fn(),
}));

vi.mock("../helpers/get-deeplink.js", () => ({
  DeepLinkType: {
    QUOTE: "QUOTE",
  },
  getDeepLink: vi.fn(),
}));

import CreateQuoteTool from "./create/create-quote.tool.js";
import UpdateQuoteTool from "./update/update-quote.tool.js";

describe("quote line item validation", () => {
  it("allows Xero's description-only line items", () => {
    const createSchema = z.object(CreateQuoteTool().schema as z.ZodRawShape);
    const updateSchema = z.object(UpdateQuoteTool().schema as z.ZodRawShape);

    expect(createSchema.safeParse({
      contactId: "contact-id",
      lineItems: [{ description: "Consulting services" }],
    }).success).toBe(true);
    expect(createSchema.safeParse({
      contactId: "contact-id",
      lineItems: [{
        description: "Consulting services",
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      }],
    }).success).toBe(true);
    expect(createSchema.safeParse({
      contactId: "contact-id",
      lineItems: [{
        description: "Consulting services",
        tracking: [{ name: "Region", option: "West" }],
      }],
    }).success).toBe(false);
    expect(updateSchema.safeParse({
      quoteId: "quote-id",
      lineItems: [{ description: "Consulting services", itemCode: "CONSULT" }],
    }).success).toBe(true);
  });

  it("rejects empty and unidentified quote line items", () => {
    const schema = z.object(CreateQuoteTool().schema as z.ZodRawShape);

    expect(schema.safeParse({ contactId: "contact-id", lineItems: [] }).success).toBe(false);
    expect(schema.safeParse({ contactId: "contact-id", lineItems: [{}] }).success).toBe(false);
  });
});
