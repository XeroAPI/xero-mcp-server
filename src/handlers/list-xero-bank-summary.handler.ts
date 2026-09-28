import { ReportWithRow } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface ListBankSummaryParams {
  fromDate?: string;
  toDate?: string;
}

async function fetchBankSummary(
  params: ListBankSummaryParams,
): Promise<ReportWithRow | null> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getReportBankSummary(
    xeroClient.tenantId,
    params.fromDate,
    params.toDate,
    getClientHeaders(),
  );

  return response.body.reports?.[0] ?? null;
}

/**
 * Bank summary report from Xero (statement opening/closing balances by bank account).
 */
export async function listXeroBankSummary(
  params: ListBankSummaryParams = {},
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const report = await fetchBankSummary(params);

    if (!report) {
      return {
        result: null,
        isError: true,
        error: "Failed to fetch bank summary data from Xero.",
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
