import {
  TimesheetLine,
} from "xero-node/dist/gen/model/payroll-nz/timesheetLine.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function updateTimesheetLine(
  timesheetID: string,
  timesheetLineID: string,
  timesheetLine: TimesheetLine
): Promise<TimesheetLine | null> {
  await xeroClient.authenticate();

  // Call the updateTimesheetLine endpoint from the PayrollNZApi
  const updatedLine = await xeroClient.payrollNZApi.updateTimesheetLine(
    xeroClient.tenantId,
    timesheetID,
    timesheetLineID,
    timesheetLine,
  );

  return updatedLine.body.timesheetLine ?? null;
}

/**
 * Update an existing timesheet line in a payroll timesheet in Xero
 */
export async function updateXeroPayrollTimesheetUpdateLine(
  timesheetID: string,
  timesheetLineID: string,
  timesheetLine: TimesheetLine
): Promise<XeroClientResponse<TimesheetLine | null>> {
  try {
    const updatedLine = await updateTimesheetLine(timesheetID, timesheetLineID, timesheetLine);

    return {
      result: updatedLine,
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