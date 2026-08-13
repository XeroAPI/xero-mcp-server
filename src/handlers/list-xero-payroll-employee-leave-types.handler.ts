import { xeroClient } from "../clients/xero-client.js";
import { xeroApiTenantId } from "../clients/tenant-context.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { EmployeeLeaveType } from "../types/payroll-nz-types.js";

/**
 * Internal function to fetch employee leave types from Xero
 */
async function fetchEmployeeLeaveTypes(employeeId: string): Promise<EmployeeLeaveType[] | null> {
  await xeroClient.authenticate();

  if (!employeeId) {
    throw new Error("Employee ID is required to fetch employee leave types");
  }

  const response = await xeroClient.payrollNZApi.getEmployeeLeaveTypes(
    xeroApiTenantId(),
    employeeId,
    getClientHeaders(),
  );

  return response.body.leaveTypes ?? null;
}

/**
 * List employee leave types from Xero Payroll
 * @param employeeId The ID of the employee to retrieve leave types for
 */
export async function listXeroPayrollEmployeeLeaveTypes(
  employeeId: string,
): Promise<XeroClientResponse<EmployeeLeaveType[]>> {
  try {
    const leaveTypes = await fetchEmployeeLeaveTypes(employeeId);

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
