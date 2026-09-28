import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { assertNewZealandPayroll } from "../helpers/get-payroll-region.js";
import { EmployeeLeave, LeavePeriod } from "../types/payroll-nz-types.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface UpdatePayrollEmployeeLeaveParams {
  employeeId: string;
  leaveId: string;
  leaveTypeID?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  periods?: LeavePeriod[];
}

async function getExistingLeave(
  employeeId: string,
  leaveId: string,
): Promise<EmployeeLeave> {
  await assertNewZealandPayroll("update-payroll-employee-leave");

  const response = await xeroClient.payrollNZApi.getEmployeeLeaves(
    xeroClient.tenantId,
    employeeId,
    getClientHeaders(),
  );

  const existing = response.body.leave?.find(
    (leave) => leave.leaveID === leaveId,
  );

  if (!existing) {
    throw new Error(
      `Leave ${leaveId} was not found for employee ${employeeId}.`,
    );
  }

  return existing;
}

async function updateEmployeeLeave(
  params: UpdatePayrollEmployeeLeaveParams,
  existing: EmployeeLeave,
): Promise<EmployeeLeave | null> {
  const employeeLeave: EmployeeLeave = {
    leaveTypeID: params.leaveTypeID ?? existing.leaveTypeID,
    description: params.description ?? existing.description,
    startDate: params.startDate ?? existing.startDate,
    endDate: params.endDate ?? existing.endDate,
    ...(params.periods ? { periods: params.periods } : {}),
  };

  const response = await xeroClient.payrollNZApi.updateEmployeeLeave(
    xeroClient.tenantId,
    params.employeeId,
    params.leaveId,
    employeeLeave,
    undefined,
    getClientHeaders(),
  );

  return response.body.leave ?? null;
}

/**
 * Update a payroll leave request for an employee in Xero (NZ Payroll).
 * Unspecified fields are copied from the existing leave so PUT can send a full body.
 */
export async function updateXeroPayrollEmployeeLeave(
  params: UpdatePayrollEmployeeLeaveParams,
): Promise<XeroClientResponse<EmployeeLeave>> {
  try {
    const existing = await getExistingLeave(params.employeeId, params.leaveId);
    const updatedLeave = await updateEmployeeLeave(params, existing);

    if (!updatedLeave) {
      throw new Error("Leave update failed.");
    }

    return {
      result: updatedLeave,
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
