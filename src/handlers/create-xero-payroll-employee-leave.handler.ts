import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { assertNewZealandPayroll } from "../helpers/get-payroll-region.js";
import { EmployeeLeave, LeavePeriod } from "../types/payroll-nz-types.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface CreatePayrollEmployeeLeaveParams {
  employeeId: string;
  leaveTypeID: string;
  description: string;
  startDate: string;
  endDate: string;
  periods?: LeavePeriod[];
}

async function createEmployeeLeave(
  params: CreatePayrollEmployeeLeaveParams,
): Promise<EmployeeLeave | null> {
  await assertNewZealandPayroll("create-payroll-employee-leave");

  const employeeLeave: EmployeeLeave = {
    leaveTypeID: params.leaveTypeID,
    description: params.description,
    startDate: params.startDate,
    endDate: params.endDate,
    ...(params.periods ? { periods: params.periods } : {}),
  };

  const response = await xeroClient.payrollNZApi.createEmployeeLeave(
    xeroClient.tenantId,
    params.employeeId,
    employeeLeave,
    undefined,
    getClientHeaders(),
  );

  return response.body.leave ?? null;
}

/**
 * Create a payroll leave request for an employee in Xero (NZ Payroll).
 */
export async function createXeroPayrollEmployeeLeave(
  params: CreatePayrollEmployeeLeaveParams,
): Promise<XeroClientResponse<EmployeeLeave>> {
  try {
    const createdLeave = await createEmployeeLeave(params);

    if (!createdLeave) {
      throw new Error("Leave creation failed.");
    }

    return {
      result: createdLeave,
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
