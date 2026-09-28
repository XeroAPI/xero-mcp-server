import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroExecutiveSummary } from "./list-xero-executive-summary.handler.js";

const report = {
  reportName: "Executive Summary",
  reportDate: "31 March 2026",
  rows: [{ rowType: "Section" }],
};

describe("listXeroExecutiveSummary", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("fetches the executive summary for an optional date", async () => {
    mockAccountingApi.getReportExecutiveSummary.mockResolvedValue({
      body: { reports: [report] },
    });

    const result = await listXeroExecutiveSummary({ date: "2026-03-31" });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(report);
    expect(mockXeroClient.authenticate).toHaveBeenCalledOnce();
    expect(mockAccountingApi.getReportExecutiveSummary).toHaveBeenCalledWith(
      "tenant-1",
      "2026-03-31",
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("returns an error when Xero omits the report", async () => {
    mockAccountingApi.getReportExecutiveSummary.mockResolvedValue({ body: {} });

    const result = await listXeroExecutiveSummary();

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Failed to fetch executive summary data from Xero.",
    });
  });

  it("returns a formatted error when the report call fails", async () => {
    mockAccountingApi.getReportExecutiveSummary.mockRejectedValue(
      new Error("insufficient_scope"),
    );

    const result = await listXeroExecutiveSummary();

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "insufficient_scope",
    });
  });
});
