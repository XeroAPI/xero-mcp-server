import { ReportWithRow } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface ListExecutiveSummaryParams {
  date?: string;
}

async function fetchExecutiveSummary(
  params: ListExecutiveSummaryParams,
): Promise<ReportWithRow | null> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getReportExecutiveSummary(
    xeroClient.tenantId,
    params.date,
    getClientHeaders(),
  );

  return response.body.reports?.[0] ?? null;
}

/**
 * Executive summary report from Xero (cash, P&L, and balance-sheet highlights).
 */
export async function listXeroExecutiveSummary(
  params: ListExecutiveSummaryParams = {},
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const report = await fetchExecutiveSummary(params);

    if (!report) {
      return {
        result: null,
        isError: true,
        error: "Failed to fetch executive summary data from Xero.",
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
