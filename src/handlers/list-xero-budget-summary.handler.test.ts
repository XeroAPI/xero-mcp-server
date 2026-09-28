import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroBudgetSummary } from "./list-xero-budget-summary.handler.js";

const report = {
  reportName: "Budget Summary",
  reportDate: "31 March 2026",
  rows: [{ rowType: "Section" }],
};

describe("listXeroBudgetSummary", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("maps MONTH/QUARTER/YEAR timeframes to Xero period sizes", async () => {
    mockAccountingApi.getReportBudgetSummary.mockResolvedValue({
      body: { reports: [report] },
    });

    await listXeroBudgetSummary({
      date: "2026-03-31",
      periods: 3,
      timeframe: "QUARTER",
    });

    expect(mockAccountingApi.getReportBudgetSummary).toHaveBeenCalledWith(
      "tenant-1",
      "2026-03-31",
      3,
      3,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );

    mockAccountingApi.getReportBudgetSummary.mockClear();
    await listXeroBudgetSummary({ timeframe: "MONTH" });
    expect(mockAccountingApi.getReportBudgetSummary.mock.calls[0][3]).toBe(1);

    mockAccountingApi.getReportBudgetSummary.mockClear();
    await listXeroBudgetSummary({ timeframe: "YEAR" });
    expect(mockAccountingApi.getReportBudgetSummary.mock.calls[0][3]).toBe(12);
  });

  it("returns the report payload", async () => {
    mockAccountingApi.getReportBudgetSummary.mockResolvedValue({
      body: { reports: [report] },
    });

    const result = await listXeroBudgetSummary();

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(report);
  });

  it("returns an error when Xero omits the report", async () => {
    mockAccountingApi.getReportBudgetSummary.mockResolvedValue({
      body: { reports: [] },
    });

    const result = await listXeroBudgetSummary();

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Failed to fetch budget summary data from Xero.",
    });
  });

  it("returns a formatted error when the report call fails", async () => {
    mockAccountingApi.getReportBudgetSummary.mockRejectedValue(
      new Error("not authorised"),
    );

    const result = await listXeroBudgetSummary();

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "not authorised",
    });
  });
});
