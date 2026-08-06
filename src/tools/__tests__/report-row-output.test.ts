import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAgedPayables: vi.fn(),
  listAgedReceivables: vi.fn(),
  listProfitAndLoss: vi.fn(),
  listTrialBalance: vi.fn(),
  listBalanceSheet: vi.fn(),
}));

vi.mock("../../handlers/list-aged-payables-by-contact.handler.js", () => ({
  listXeroAgedPayablesByContact: mocks.listAgedPayables,
}));

vi.mock("../../handlers/list-aged-receivables-by-contact.handler.js", () => ({
  listXeroAgedReceivablesByContact: mocks.listAgedReceivables,
}));

vi.mock("../../handlers/list-xero-profit-and-loss.handler.js", () => ({
  listXeroProfitAndLoss: mocks.listProfitAndLoss,
}));

vi.mock("../../handlers/list-xero-trial-balance.handler.js", () => ({
  listXeroTrialBalance: mocks.listTrialBalance,
}));

vi.mock("../../handlers/list-xero-report-balance-sheet.handler.js", () => ({
  listXeroReportBalanceSheet: mocks.listBalanceSheet,
}));

import ListAgedPayablesByContact from "../list/list-aged-payables-by-contact.tool.js";
import ListAgedReceivablesByContact from "../list/list-aged-receivables-by-contact.tool.js";
import ListProfitAndLossTool from "../list/list-profit-and-loss.tool.js";
import ListReportBalanceSheetTool from "../list/list-report-balance-sheet.tool.js";
import ListTrialBalanceTool from "../list/list-trial-balance.tool.js";

const emptyRowsReport = {
  reportName: "Example report",
  reportDate: "2026-08-06",
};

describe("report row output", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an empty array when an aged payables report omits rows", async () => {
    mocks.listAgedPayables.mockResolvedValue({ isError: false, result: emptyRowsReport });

    const result = await ListAgedPayablesByContact().handler({ contactId: "contact-id" }, {} as never);

    expect(result.content.at(-1)).toEqual({ type: "text", text: "[]" });
  });

  it("renders an empty array when an aged receivables report omits rows", async () => {
    mocks.listAgedReceivables.mockResolvedValue({ isError: false, result: emptyRowsReport });

    const result = await ListAgedReceivablesByContact().handler({ contactId: "contact-id" }, {} as never);

    expect(result.content.at(-1)).toEqual({ type: "text", text: "[]" });
  });

  it("renders an empty array when a profit and loss report omits rows", async () => {
    mocks.listProfitAndLoss.mockResolvedValue({ error: null, result: emptyRowsReport });

    const result = await ListProfitAndLossTool().handler({}, {} as never);

    expect(result.content.at(-1)).toEqual({ type: "text", text: "[]" });
  });

  it("renders an empty array when a trial balance report omits rows", async () => {
    mocks.listTrialBalance.mockResolvedValue({ error: null, result: emptyRowsReport });

    const result = await ListTrialBalanceTool().handler({}, {} as never);

    expect(result.content.at(-1)).toEqual({ type: "text", text: "[]" });
  });

  it("renders an empty array when a balance sheet report omits rows", async () => {
    mocks.listBalanceSheet.mockResolvedValue({ error: null, result: emptyRowsReport });

    const result = await ListReportBalanceSheetTool().handler({}, {} as never);

    expect(result.content.at(-1)).toEqual({ type: "text", text: "[]" });
  });
});
