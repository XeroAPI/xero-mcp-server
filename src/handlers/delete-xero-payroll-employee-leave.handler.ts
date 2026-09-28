import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { assertNewZealandPayroll } from "../helpers/get-payroll-region.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface DeletePayrollEmployeeLeaveParams {
  employeeId: string;
  leaveId: string;
}

async function deleteEmployeeLeave(
  params: DeletePayrollEmployeeLeaveParams,
): Promise<void> {
  await assertNewZealandPayroll("delete-payroll-employee-leave");

  await xeroClient.payrollNZApi.deleteEmployeeLeave(
    xeroClient.tenantId,
    params.employeeId,
    params.leaveId,
    getClientHeaders(),
  );
}

/**
 * Delete a payroll leave request for an employee in Xero (NZ Payroll).
 */
export async function deleteXeroPayrollEmployeeLeave(
  params: DeletePayrollEmployeeLeaveParams,
): Promise<XeroClientResponse<boolean>> {
  try {
    await deleteEmployeeLeave(params);

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
