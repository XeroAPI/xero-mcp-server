import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroProfitAndLoss: vi.fn(),
}));

vi.mock("../../handlers/list-xero-profit-and-loss.handler.js", () => ({
  listXeroProfitAndLoss: mocks.listXeroProfitAndLoss,
}));

import ListProfitAndLossTool from "./list-profit-and-loss.tool.js";

describe("list-profit-and-loss periods", () => {
  it("forwards Xero's supported 12-period annual comparison", async () => {
    mocks.listXeroProfitAndLoss.mockResolvedValue({
      result: { rows: [] },
      isError: false,
      error: null,
    });

    await ListProfitAndLossTool().handler({ periods: 12 }, {} as never);

    expect(mocks.listXeroProfitAndLoss).toHaveBeenCalledWith(
      undefined,
      undefined,
      12,
      undefined,
      undefined,
      undefined,
    );
  });
});
