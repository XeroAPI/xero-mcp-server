import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getReportBalanceSheet: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getReportBalanceSheet: mocks.getReportBalanceSheet,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { listXeroReportBalanceSheet } from "../list-xero-report-balance-sheet.handler.js";

describe("listXeroReportBalanceSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReportBalanceSheet.mockResolvedValue({
      body: { reports: [{ reportName: "Balance Sheet" }] },
    });
  });

  it("does not replace a supplied zero period count with the Xero default", async () => {
    await listXeroReportBalanceSheet({ periods: 0 });

    expect(mocks.getReportBalanceSheet).toHaveBeenCalledWith(
      "tenant-id",
      undefined,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      expect.any(Object),
    );
  });
});
