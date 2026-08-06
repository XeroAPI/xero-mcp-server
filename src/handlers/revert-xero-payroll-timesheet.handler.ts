import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function revertTimesheet(
  timesheetID: string,
  idempotencyKey?: string,
): Promise<Timesheet | null> {
  await xeroClient.authenticate();

  // Call the revertTimesheet endpoint from the PayrollNZApi
  const revertedTimesheet = await xeroClient.payrollNZApi.revertTimesheet(
    xeroClient.tenantId,
    timesheetID,
    idempotencyKey,
  );

  return revertedTimesheet.body.timesheet ?? null;
}

/**
 * Revert a payroll timesheet to draft in Xero
 */
export async function revertXeroPayrollTimesheet(
  timesheetID: string,
  idempotencyKey?: string,
): Promise<
  XeroClientResponse<Timesheet | null>
> {
  try {
    const revertedTimesheet = await revertTimesheet(timesheetID, idempotencyKey);

    return {
      result: revertedTimesheet,
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
