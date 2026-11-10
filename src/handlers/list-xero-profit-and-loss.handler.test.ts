import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateMock = vi.fn();
const getReportProfitAndLossMock = vi.fn();
const getClientHeadersMock = vi.fn(() => ({ "x-test": "header" }));

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-123",
    authenticate: authenticateMock,
    accountingApi: {
      getReportProfitAndLoss: getReportProfitAndLossMock,
    },
  },
}));

vi.mock("../helpers/get-client-headers.js", () => ({
  getClientHeaders: getClientHeadersMock,
}));

describe("listXeroProfitAndLoss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards standardLayout and paymentsOnly to the SDK in the correct positions", async () => {
    const report = {
      reportName: "Profit and Loss",
      reportDate: "2026-06-12",
      rows: [],
    };

    getReportProfitAndLossMock.mockResolvedValue({
      body: { reports: [report] },
    });

    const { listXeroProfitAndLoss } = await import(
      "./list-xero-profit-and-loss.handler.js"
    );

    const result = await listXeroProfitAndLoss(
      "2026-01-01",
      "2026-01-31",
      1,
      "MONTH",
      true,
      true,
    );

    expect(result.isError).toBe(false);
    expect(result.result).toBe(report);
    expect(authenticateMock).toHaveBeenCalledTimes(1);
    expect(getReportProfitAndLossMock).toHaveBeenCalledWith(
      "tenant-123",
      "2026-01-01",
      "2026-01-31",
      1,
      "MONTH",
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      true,
      { "x-test": "header" },
    );
  });
});
