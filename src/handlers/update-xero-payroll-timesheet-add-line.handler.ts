import {
  TimesheetLine,
} from "xero-node/dist/gen/model/payroll-nz/timesheetLine.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function addTimesheetLine(
  timesheetID: string,
  timesheetLine: TimesheetLine,
  idempotencyKey?: string,
): Promise<TimesheetLine | null> {
  await xeroClient.authenticate();

  // Call the createTimesheetLine endpoint from the PayrollNZApi
  const createdLine = await xeroClient.payrollNZApi.createTimesheetLine(
    xeroClient.tenantId,
    timesheetID,
    timesheetLine,
    idempotencyKey,
  );

  return createdLine.body.timesheetLine ?? null;
}

/**
 * Add a timesheet line to an existing payroll timesheet in Xero
 */
export async function updateXeroPayrollTimesheetAddLine(
  timesheetID: string,
  timesheetLine: TimesheetLine,
  idempotencyKey?: string,
): Promise<
  XeroClientResponse<TimesheetLine | null>
> {
  try {
    const newLine = await addTimesheetLine(timesheetID, timesheetLine, idempotencyKey);

    return {
      result: newLine,
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
