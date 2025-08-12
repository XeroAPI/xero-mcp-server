import {
  TimesheetLine,
} from "xero-node/dist/gen/model/payroll-nz/timesheetLine.js";

import { createXeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function updateTimesheetLine(
  bearerToken: string,
  timesheetID: string,
  timesheetLineID: string,
  timesheetLine: TimesheetLine
): Promise<TimesheetLine | null> {
  const xeroClient = createXeroClient(bearerToken);
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
  bearerToken: string,
  timesheetID: string,
  timesheetLineID: string,
  timesheetLine: TimesheetLine
): Promise<XeroClientResponse<TimesheetLine | null>> {
  try {
    const updatedLine = await updateTimesheetLine(bearerToken, timesheetID, timesheetLineID, timesheetLine);

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