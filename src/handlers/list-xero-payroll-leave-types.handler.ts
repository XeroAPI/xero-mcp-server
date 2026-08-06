import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { LeaveType } from "../types/payroll-nz-types.js";

/**
 * Internal function to fetch leave types from Xero
 */
async function fetchLeaveTypes(page?: number): Promise<LeaveType[] | null> {
  await xeroClient.authenticate();

  const response = await xeroClient.payrollNZApi.getLeaveTypes(
    xeroClient.tenantId,
    page, // page
    undefined, // activeOnly
    getClientHeaders(),
  );

  return response.body.leaveTypes ?? null;
}

/**
 * List a page of leave types from Xero Payroll
 */
export async function listXeroPayrollLeaveTypes(page?: number): Promise<
  XeroClientResponse<LeaveType[]>
> {
  try {
    const leaveTypes = await fetchLeaveTypes(page);

    if (!leaveTypes) {
      return {
        result: [],
        isError: false,
        error: null,
      };
    }

    return {
      result: leaveTypes,
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
