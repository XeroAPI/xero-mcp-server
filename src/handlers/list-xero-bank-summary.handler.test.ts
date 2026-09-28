import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroBankSummary } from "./list-xero-bank-summary.handler.js";

const report = {
  reportName: "Bank Summary",
  reportDate: "1 February 2026 to 28 February 2026",
  rows: [{ rowType: "Header" }],
};

describe("listXeroBankSummary", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("fetches the bank summary with no date filters", async () => {
    mockAccountingApi.getReportBankSummary.mockResolvedValue({
      body: { reports: [report] },
    });

    const result = await listXeroBankSummary();

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(report);
    expect(mockXeroClient.authenticate).toHaveBeenCalledOnce();
    expect(mockAccountingApi.getReportBankSummary).toHaveBeenCalledWith(
      "tenant-1",
      undefined,
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("forwards fromDate and toDate", async () => {
    mockAccountingApi.getReportBankSummary.mockResolvedValue({
      body: { reports: [report] },
    });

    await listXeroBankSummary({
      fromDate: "2026-02-01",
      toDate: "2026-02-28",
    });

    expect(mockAccountingApi.getReportBankSummary).toHaveBeenCalledWith(
      "tenant-1",
      "2026-02-01",
      "2026-02-28",
      expect.anything(),
    );
  });

  it("returns an error when Xero omits the report", async () => {
    mockAccountingApi.getReportBankSummary.mockResolvedValue({ body: {} });

    const result = await listXeroBankSummary();

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Failed to fetch bank summary data from Xero.",
    });
  });

  it("returns a formatted error when the report call fails", async () => {
    mockAccountingApi.getReportBankSummary.mockRejectedValue(
      new Error("insufficient_scope"),
    );

    const result = await listXeroBankSummary();

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "insufficient_scope",
    });
  });
});
