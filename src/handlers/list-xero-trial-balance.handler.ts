import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ReportWithRow } from "xero-node";

/**
 * Internal function to fetch trial balance data from Xero
 */
async function fetchTrialBalance(
  date?: string,
  paymentsOnly?: boolean,
): Promise<ReportWithRow | null> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getReportTrialBalance(
    xeroClient.tenantId,
    date, // Optional date parameter in YYYY-MM-DD format
    paymentsOnly, // Optional boolean to include only accounts with payments
    getClientHeaders(),
  );

  return response.body.reports?.[0] ?? null;
}

/**
 * List trial balance report from Xero
 * @param date Optional date for trial balance in YYYY-MM-DD format
 * @param paymentsOnly Optional boolean to include only accounts with payments
 */
export async function listXeroTrialBalance(
  date?: string,
  paymentsOnly?: boolean,
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const trialBalance = await fetchTrialBalance(date, paymentsOnly);

    if (!trialBalance) {
      return {
        result: null,
        isError: true,
        error: "Failed to fetch trial balance data from Xero.",
      };
    }

    return {
      result: trialBalance,
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