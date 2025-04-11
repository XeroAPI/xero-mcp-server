import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function createTimesheet(timesheet: Timesheet): Promise<Timesheet | null> {
  await xeroClient.authenticate();

  // Call the createTimesheet endpoint from the PayrollNZApi
  const createdTimesheet = await xeroClient.payrollNZApi.createTimesheet(
    xeroClient.tenantId,
    timesheet,
  );

  return createdTimesheet.body.timesheet ?? null;
}

/**
 * Create a payroll timesheet in Xero
 */
export async function createXeroPayrollTimesheet(timesheet: Timesheet): Promise<
  XeroClientResponse<Timesheet | null>
> {
  try {
    const newTimesheet = await createTimesheet(timesheet);

    return {
      result: newTimesheet,
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