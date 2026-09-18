import { BookkeepingError, accounting, finance } from "./core.js";

export async function cashFlowStatement(fromDate?: string, toDate?: string): Promise<unknown> {
  return finance("getFinancialStatementCashflow", [fromDate, toDate], "GET /FinancialStatements/Cashflow");
}

export async function reportProfitAndLoss(input: { fromDate?: string; toDate?: string; periods?: number; timeframe?: "MONTH" | "QUARTER" | "YEAR"; trackingCategoryId?: string; trackingCategoryId2?: string; trackingOptionId?: string; trackingOptionId2?: string; standardLayout?: boolean; paymentsOnly?: boolean }): Promise<unknown> {
  return accounting("getReportProfitAndLoss", [input.fromDate, input.toDate, input.periods, input.timeframe, input.trackingCategoryId, input.trackingCategoryId2, input.trackingOptionId, input.trackingOptionId2, input.standardLayout, input.paymentsOnly], "GET /Reports/ProfitAndLoss");
}

export async function reportBalanceSheet(input: { date?: string; periods?: number; timeframe?: "MONTH" | "QUARTER" | "YEAR"; trackingOptionId1?: string; trackingOptionId2?: string; standardLayout?: boolean; paymentsOnly?: boolean }): Promise<unknown> {
  return accounting("getReportBalanceSheet", [input.date, input.periods, input.timeframe, input.trackingOptionId1, input.trackingOptionId2, input.standardLayout, input.paymentsOnly], "GET /Reports/BalanceSheet");
}

export async function reportTrialBalance(date?: string, paymentsOnly?: boolean): Promise<unknown> {
  return accounting("getReportTrialBalance", [date, paymentsOnly], "GET /Reports/TrialBalance");
}

export async function reportAged(type: "receivables" | "payables", input: { contactId?: string; date?: string; fromDate?: string; toDate?: string }): Promise<unknown> {
  if (!input.contactId) throw new BookkeepingError("Xero's aged-by-contact endpoint requires a contact ID. Use receivables_summary or payables_summary for an organisation-wide summary.", `GET /Reports/Aged${type === "receivables" ? "Receivables" : "Payables"}ByContact`, { status: 422 });
  const method = type === "receivables" ? "getReportAgedReceivablesByContact" : "getReportAgedPayablesByContact";
  return accounting(method, [input.contactId, input.date, input.fromDate, input.toDate], `GET /Reports/Aged${type === "receivables" ? "Receivables" : "Payables"}ByContact`);
}

export async function reportBudgetSummary(input: { date?: string; periods?: number; timeframe?: number }): Promise<unknown> {
  return accounting("getReportBudgetSummary", [input.date, input.periods, input.timeframe], "GET /Reports/BudgetSummary");
}

export async function reportExecutiveSummary(date?: string): Promise<unknown> {
  return accounting("getReportExecutiveSummary", [date], "GET /Reports/ExecutiveSummary");
}

export async function reportBankSummary(fromDate?: string, toDate?: string): Promise<unknown> {
  return accounting("getReportBankSummary", [fromDate, toDate], "GET /Reports/BankSummary");
}

export async function listTaxReports(): Promise<unknown> {
  return accounting("getReportsList", [], "GET /Reports");
}

export async function getTaxReport(reportId: string): Promise<unknown> {
  return accounting("getReportFromId", [reportId], "GET /Reports/{ReportID}");
}
