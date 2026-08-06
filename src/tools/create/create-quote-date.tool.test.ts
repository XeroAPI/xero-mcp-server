import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../handlers/create-xero-quote.handler.js", () => ({
  createXeroQuote: vi.fn(),
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: {
    QUOTE: "QUOTE",
  },
  getDeepLink: vi.fn(),
}));

import CreateQuoteTool from "./create-quote.tool.js";

describe("create-quote date inputs", () => {
  it("accepts optional issue and expiry dates", () => {
    const schema = z.object(CreateQuoteTool().schema as z.ZodRawShape);

    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{
        description: "Consulting",
        quantity: 1,
        unitAmount: 100,
        accountCode: "200",
        taxType: "OUTPUT",
      }],
      date: "2026-08-06",
      expiryDate: "2026-08-20",
    }).success).toBe(true);
  });
});
