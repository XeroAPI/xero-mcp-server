import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function deleteTimesheet(timesheetID: string): Promise<boolean> {
  await xeroClient.authenticate();

  // Call the deleteTimesheet endpoint from the PayrollNZApi
  await xeroClient.payrollNZApi.deleteTimesheet(xeroClient.tenantId, timesheetID);

  return true;
}

/**
 * Delete an existing payroll timesheet in Xero
 */
export async function deleteXeroPayrollTimesheet(timesheetID: string): Promise<
  XeroClientResponse<boolean>
> {
  try {
    await deleteTimesheet(timesheetID);

    return {
      result: true,
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