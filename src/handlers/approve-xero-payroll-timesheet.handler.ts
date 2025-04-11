import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function approveTimesheet(timesheetID: string): Promise<Timesheet | null> {
  await xeroClient.authenticate();

  // Call the approveTimesheet endpoint from the PayrollNZApi
  const approvedTimesheet = await xeroClient.payrollNZApi.approveTimesheet(
    xeroClient.tenantId,
    timesheetID,
  );

  return approvedTimesheet.body.timesheet ?? null;
}

/**
 * Approve a payroll timesheet in Xero
 */
export async function approveXeroPayrollTimesheet(timesheetID: string): Promise<
  XeroClientResponse<Timesheet | null>
> {
  try {
    const approvedTimesheet = await approveTimesheet(timesheetID);

    return {
      result: approvedTimesheet,
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