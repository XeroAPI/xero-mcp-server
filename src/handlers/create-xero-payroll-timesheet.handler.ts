import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function createTimesheet(
  timesheet: Timesheet,
  idempotencyKey?: string,
): Promise<Timesheet | null> {
  await xeroClient.authenticate();

  // Call the createTimesheet endpoint from the PayrollNZApi
  const createdTimesheet = await xeroClient.payrollNZApi.createTimesheet(
    xeroClient.tenantId,
    timesheet,
    idempotencyKey,
  );

  return createdTimesheet.body.timesheet ?? null;
}

/**
 * Create a payroll timesheet in Xero
 */
export async function createXeroPayrollTimesheet(
  timesheet: Timesheet,
  idempotencyKey?: string,
): Promise<
  XeroClientResponse<Timesheet | null>
> {
  try {
    const newTimesheet = await createTimesheet(timesheet, idempotencyKey);

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
