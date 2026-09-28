import { beforeEach, describe, expect, it, vi } from "vitest";

const { listXeroQuotes } = vi.hoisted(() => ({
  listXeroQuotes: vi.fn(),
}));

vi.mock("../../handlers/list-xero-quotes.handler.js", () => ({
  listXeroQuotes,
}));

import ListQuotesTool from "./list-quotes.tool.js";

describe("list-quotes tool", () => {
  beforeEach(() => {
    listXeroQuotes.mockReset();
  });

  it("includes each quote line item instead of only totals", async () => {
    listXeroQuotes.mockResolvedValue({
      result: [
        {
          quoteID: "q-1",
          quoteNumber: "QU-0007",
          contact: { contactID: "c-1", name: "ABC Limited" },
          total: 600,
          lineItems: [
            {
              description: "Half day training - Microsoft Office",
              quantity: 1,
              unitAmount: 500,
              accountCode: "400",
              taxType: "NONE",
            },
            {
              description: "Travel expenses",
              quantity: 2,
              unitAmount: 50,
              accountCode: "400",
              taxType: "NONE",
            },
          ],
        },
      ],
      isError: false,
      error: null,
    });

    const result = await ListQuotesTool().handler(
      { page: 1 },
      {} as never,
    );

    const text = result.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("\n");

    expect(text).toContain("Line Items (2):");
    expect(text).toContain("Half day training - Microsoft Office");
    expect(text).toContain("Travel expenses");
    expect(text).toContain("Quantity: 1");
    expect(text).toContain("Quantity: 2");
  });
});
