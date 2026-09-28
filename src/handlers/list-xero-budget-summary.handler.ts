import { ReportWithRow } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export type BudgetTimeframe = "MONTH" | "QUARTER" | "YEAR";

const BUDGET_TIMEFRAME: Record<BudgetTimeframe, number> = {
  MONTH: 1,
  QUARTER: 3,
  YEAR: 12,
};

export interface ListBudgetSummaryParams {
  date?: string;
  periods?: number;
  timeframe?: BudgetTimeframe;
}

async function fetchBudgetSummary(
  params: ListBudgetSummaryParams,
): Promise<ReportWithRow | null> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getReportBudgetSummary(
    xeroClient.tenantId,
    params.date,
    params.periods,
    params.timeframe ? BUDGET_TIMEFRAME[params.timeframe] : undefined,
    getClientHeaders(),
  );

  return response.body.reports?.[0] ?? null;
}

/**
 * Budget summary report from Xero (budget vs actual by period).
 */
export async function listXeroBudgetSummary(
  params: ListBudgetSummaryParams = {},
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const report = await fetchBudgetSummary(params);

    if (!report) {
      return {
        result: null,
        isError: true,
        error: "Failed to fetch budget summary data from Xero.",
      };
    }

    return {
      result: report,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
