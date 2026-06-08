import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { EmployeeLeave as NzEmployeeLeave } from "../types/payroll-nz-types.js";
import { EmployeeLeave as UkEmployeeLeave } from "xero-node/dist/gen/model/payroll-uk/employeeLeave.js";

export interface EmployeeLeaveResult {
  leaveID?: string;
  leaveTypeID?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  periods?: unknown[];
  updatedDateUTC?: Date;
}

function mapLeave(l: NzEmployeeLeave | UkEmployeeLeave): EmployeeLeaveResult {
  return {
    leaveID: l.leaveID,
    leaveTypeID: l.leaveTypeID,
    description: l.description,
    startDate: l.startDate,
    endDate: l.endDate,
    periods: l.periods,
    updatedDateUTC: l.updatedDateUTC,
  };
}

/**
 * List employee leave records from Xero Payroll, routing to the correct
 * regional API. AU orgs use leave applications (a different model) and are
 * not supported by this tool.
 */
export async function listXeroPayrollEmployeeLeave(
  employeeId: string,
): Promise<XeroClientResponse<EmployeeLeaveResult[]>> {
  try {
    if (!employeeId) {
      throw new Error("Employee ID is required to fetch employee leave");
    }

    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    if (region === "AU") {
      return {
        result: null,
        isError: true,
        error:
          "Listing employee leave is not supported for AU orgs. AU payroll uses leave applications, which are not yet available in this MCP server.",
      };
    }

    const api =
      region === "UK" ? xeroClient.payrollUKApi : xeroClient.payrollNZApi;

    const response = await api.getEmployeeLeaves(
      xeroClient.tenantId,
      employeeId,
      { headers: getClientHeaders().headers },
    );

    const leave = (response.body.leave ?? []).map(mapLeave);

    return { result: leave, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
