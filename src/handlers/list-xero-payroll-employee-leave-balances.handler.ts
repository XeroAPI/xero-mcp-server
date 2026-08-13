import { xeroClient } from "../clients/xero-client.js";
import { xeroApiTenantId } from "../clients/tenant-context.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { EmployeeLeaveBalance } from "../types/payroll-nz-types.js";

/**
 * Internal function to fetch employee leave balances from Xero
 */
async function fetchEmployeeLeaveBalances(employeeId: string): Promise<EmployeeLeaveBalance[] | null> {
  if (!employeeId) {
    throw new Error("Employee ID is required to fetch employee leave balances");
  }

  const response = await xeroClient.payrollNZApi.getEmployeeLeaveBalances(
    xeroApiTenantId(),
    employeeId,
    getClientHeaders(),
  );

  return response.body.leaveBalances ?? null;
}

/**
 * List employee leave balances from Xero Payroll
 * @param employeeId The ID of the employee to retrieve leave balances for
 */
export async function listXeroPayrollEmployeeLeaveBalances(
  employeeId: string,
): Promise<XeroClientResponse<EmployeeLeaveBalance[]>> {
  try {
    const leaveBalances = await fetchEmployeeLeaveBalances(employeeId);

    if (!leaveBalances) {
      return {
        result: [],
        isError: false,
        error: null,
      };
    }

    return {
      result: leaveBalances,
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
