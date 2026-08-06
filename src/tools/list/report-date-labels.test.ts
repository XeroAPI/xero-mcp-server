import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroProfitAndLoss: vi.fn(),
  listXeroReportBalanceSheet: vi.fn(),
  listXeroTrialBalance: vi.fn(),
}));

vi.mock("../../handlers/list-xero-profit-and-loss.handler.js", () => ({
  listXeroProfitAndLoss: mocks.listXeroProfitAndLoss,
}));

vi.mock("../../handlers/list-xero-trial-balance.handler.js", () => ({
  listXeroTrialBalance: mocks.listXeroTrialBalance,
}));

vi.mock("../../handlers/list-xero-report-balance-sheet.handler.js", () => ({
  listXeroReportBalanceSheet: mocks.listXeroReportBalanceSheet,
}));

import ListReportBalanceSheetTool from "./list-report-balance-sheet.tool.js";
import ListProfitAndLossTool from "./list-profit-and-loss.tool.js";
import ListTrialBalanceTool from "./list-trial-balance.tool.js";

describe("report date labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listXeroProfitAndLoss.mockResolvedValue({
      result: {
        reportName: "Profit and Loss",
        reportDate: "2026-08-06",
        reportTitles: ["Profit & Loss", "Example organisation", "1 July 2026 to 31 July 2026"],
        rows: [],
      },
      isError: false,
      error: null,
    });
    mocks.listXeroTrialBalance.mockResolvedValue({
      result: {
        reportName: "Trial Balance",
        reportDate: "2026-08-06",
        reportTitles: ["Trial Balance", "Example organisation", "As at 31 July 2026"],
        rows: [],
      },
      isError: false,
      error: null,
    });
    mocks.listXeroReportBalanceSheet.mockResolvedValue({
      result: {
        reportName: "Balance Sheet",
        reportDate: "2026-08-06",
        reportTitles: ["Balance Sheet", "Example organisation", "As at 31 July 2026"],
        rows: [],
      },
      isError: false,
      error: null,
    });
  });

  it("separates the requested reporting period from report metadata", async () => {
    const profitAndLoss = await ListProfitAndLossTool().handler({}, {} as never);
    const trialBalance = await ListTrialBalanceTool().handler({}, {} as never);
    const balanceSheet = await ListReportBalanceSheetTool().handler({}, {} as never);

    expect(profitAndLoss.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "Requested period: 1 July 2026 to 31 July 2026" }),
      expect.objectContaining({ text: "Generated date: 2026-08-06" }),
    ]));
    expect(trialBalance.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "Requested period: As at 31 July 2026" }),
      expect.objectContaining({ text: "Generated date: 2026-08-06" }),
    ]));
    expect(balanceSheet.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "Requested period: As at 31 July 2026" }),
      expect.objectContaining({ text: "Generated date: 2026-08-06" }),
    ]));
  });
});
