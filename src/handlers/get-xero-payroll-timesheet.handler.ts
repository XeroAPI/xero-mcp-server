import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import { createXeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getTimesheet(bearerToken: string, timesheetID: string): Promise<Timesheet | null> {
  const xeroClient = createXeroClient(bearerToken);
  await xeroClient.authenticate();

  // Call the Timesheet endpoint from the PayrollNZApi
  const timesheet = await xeroClient.payrollNZApi.getTimesheet(
    xeroClient.tenantId,
    timesheetID,
  );

  return timesheet.body.timesheet ?? null;
}

/**
 * Get a single payroll timesheet from Xero
 */
export async function getXeroPayrollTimesheet(bearerToken: string, timesheetID: string): Promise<
  XeroClientResponse<Timesheet | null>
> {
  try {
    const timesheet = await getTimesheet(bearerToken, timesheetID);

    return {
      result: timesheet,
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