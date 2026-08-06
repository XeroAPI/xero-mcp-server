import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listTaxRates: vi.fn(),
}));

vi.mock("../../handlers/list-xero-tax-rates.handler.js", () => ({
  listXeroTaxRates: mocks.listTaxRates,
}));

import ListTaxRatesTool from "../list/list-tax-rates.tool.js";

describe("list-tax-rates output", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a real zero rate but does not fabricate omitted rates", async () => {
    mocks.listTaxRates.mockResolvedValue({
      error: null,
      result: [
        {
          name: "Zero rate",
          taxType: "ZERO",
          status: "ACTIVE",
          displayTaxRate: 0,
          effectiveRate: 0,
        },
        {
          name: "Unspecified rate",
          taxType: "UNKNOWN",
          status: "ACTIVE",
        },
      ],
    });

    const result = await ListTaxRatesTool().handler({}, {} as never);

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining("Display Tax Rate: 0%\nEffective Rate: 0%"),
    });
    expect(result.content[2]).not.toMatchObject({
      text: expect.stringContaining("Display Tax Rate:"),
    });
    expect(result.content[2]).not.toMatchObject({
      text: expect.stringContaining("Effective Rate:"),
    });
  });
});
