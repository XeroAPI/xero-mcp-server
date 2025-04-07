import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ReportWithRows } from "xero-node";

// Define the valid timeframe options
type TimeframeType = "MONTH" | "QUARTER" | "YEAR" | undefined;

/**
 * Internal function to fetch profit and loss data from Xero
 */
async function fetchProfitAndLoss(
  fromDate?: string,
  toDate?: string,
  periods?: number,
  timeframe?: TimeframeType,
  trackingCategoryID?: string,
  trackingOptionID?: string,
  trackingCategoryID2?: string,
  trackingOptionID2?: string,
  standardLayout?: boolean,
  paymentsOnly?: boolean
): Promise<ReportWithRows> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getReportProfitAndLoss(
    xeroClient.tenantId,
    fromDate,
    toDate,
    periods,
    timeframe,
    trackingCategoryID,
    trackingOptionID,
    trackingCategoryID2,
    trackingOptionID2,
    standardLayout,
    paymentsOnly,
    getClientHeaders(),
  );

  return response.body;
}

/**
 * List profit and loss report from Xero
 * @param fromDate Optional start date for the report (YYYY-MM-DD)
 * @param toDate Optional end date for the report (YYYY-MM-DD)
 * @param periods Optional number of periods for the report
 * @param timeframe Optional timeframe for the report (MONTH, QUARTER, YEAR)
 * @param trackingCategoryID Optional tracking category ID
 * @param trackingOptionID Optional tracking option ID
 * @param trackingCategoryID2 Optional second tracking category ID
 * @param trackingOptionID2 Optional second tracking option ID
 * @param standardLayout Optional boolean to use standard layout
 * @param paymentsOnly Optional boolean to include only accounts with payments
 */
export async function listXeroProfitAndLoss(
  fromDate?: string,
  toDate?: string,
  periods?: number,
  timeframe?: TimeframeType,
  trackingCategoryID?: string,
  trackingOptionID?: string,
  trackingCategoryID2?: string,
  trackingOptionID2?: string,
  standardLayout?: boolean,
  paymentsOnly?: boolean
): Promise<XeroClientResponse<ReportWithRows>> {
  try {
    const profitAndLoss = await fetchProfitAndLoss(
      fromDate,
      toDate,
      periods,
      timeframe,
      trackingCategoryID,
      trackingOptionID,
      trackingCategoryID2,
      trackingOptionID2,
      standardLayout,
      paymentsOnly
    );

    return {
      result: profitAndLoss,
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