import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { ListProfitAndLossParams } from "../types/list-profit-and-loss-params.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ReportWithRow } from "xero-node";

/**
 * Internal function to fetch profit and loss data from Xero
 */
async function fetchProfitAndLoss(
  params: ListProfitAndLossParams,
): Promise<ReportWithRow | null> {
  await xeroClient.authenticate();

  const {
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
  } = params;

  const response = await xeroClient.accountingApi.getReportProfitAndLoss(
    xeroClient.tenantId,
    fromDate,
    toDate,
    periods,
    timeframe,
    trackingCategoryID,
    trackingCategoryID2,
    trackingOptionID,
    trackingOptionID2,
    standardLayout,
    paymentsOnly,
    getClientHeaders(),
  );

  return response.body.reports?.[0] ?? null;
}

/**
 * List profit and loss report from Xero
 * @param params Optional parameters for the report:
 *  - fromDate: Optional start date for the report (YYYY-MM-DD)
 *  - toDate: Optional end date for the report (YYYY-MM-DD)
 *  - periods: Optional number of periods for the report
 *  - timeframe: Optional timeframe for the report (MONTH, QUARTER, YEAR)
 *  - trackingCategoryID: Optional tracking category ID
 *  - trackingOptionID: Optional tracking option ID
 *  - trackingCategoryID2: Optional second tracking category ID
 *  - trackingOptionID2: Optional second tracking option ID
 *  - standardLayout: Optional boolean to use standard layout
 *  - paymentsOnly: Optional boolean to include only accounts with payments
 */
export async function listXeroProfitAndLoss(
  params: ListProfitAndLossParams,
): Promise<XeroClientResponse<ReportWithRow>> {
  try {
    const profitAndLoss = await fetchProfitAndLoss(params);

    if (!profitAndLoss) {
      return {
        result: null,
        isError: true,
        error: "Failed to fetch profit and loss data from Xero.",
      };
    }

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
