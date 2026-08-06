import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createXeroQuote: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-quote.handler.js", () => ({
  createXeroQuote: mocks.createXeroQuote,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { QUOTE: "QUOTE" },
  getDeepLink: mocks.getDeepLink,
}));

import CreateQuoteTool from "./create-quote.tool.js";

describe("create-quote tool", () => {
  const tool = CreateQuoteTool();
  const schema = z.object(tool.schema as z.ZodRawShape);

  it("forwards quote discounts and tracking option IDs", async () => {
    mocks.createXeroQuote.mockResolvedValue({
      result: { quoteID: "quote-id" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);

    await tool.handler({
      contactId: "contact-id",
      lineItems: [{
        description: "Consulting services",
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      }],
      idempotencyKey: "quote-retry-key",
    }, {} as never);

    expect(mocks.createXeroQuote).toHaveBeenCalledWith(
      "contact-id",
      [expect.objectContaining({
        tracking: [{ trackingOptionID: "tracking-option-id" }],
        discountRate: 10,
        discountAmount: 5,
      })],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "quote-retry-key",
    );
  });

  it("limits idempotency keys to Xero's supported length", () => {
    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{ description: "Consulting services" }],
      idempotencyKey: "x".repeat(128),
    }).success).toBe(true);
    expect(schema.safeParse({
      contactId: "contact-id",
      lineItems: [{ description: "Consulting services" }],
      idempotencyKey: "x".repeat(129),
    }).success).toBe(false);
  });
});
