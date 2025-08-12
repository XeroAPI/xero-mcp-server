import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import { createXeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getTimesheets(bearerToken: string): Promise<Timesheet[]> {
  const xeroClient = createXeroClient(bearerToken);
  await xeroClient.authenticate();

  // Call the Timesheets endpoint from the PayrollNZApi
  const timesheets = await xeroClient.payrollNZApi.getTimesheets(
    xeroClient.tenantId,
    undefined, // page
    undefined, // filter
  );

  return timesheets.body.timesheets ?? [];
}

/**
 * List all payroll timesheets from Xero
 */
export async function listXeroPayrollTimesheets(bearerToken: string): Promise<
  XeroClientResponse<Timesheet[]>
> {
  try {
    const timesheets = await getTimesheets(bearerToken);

    return {
      result: timesheets,
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