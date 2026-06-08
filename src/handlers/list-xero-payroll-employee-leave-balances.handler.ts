import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { EmployeeLeaveBalance as NzEmployeeLeaveBalance } from "../types/payroll-nz-types.js";
import { EmployeeLeaveBalance as UkEmployeeLeaveBalance } from "xero-node/dist/gen/model/payroll-uk/employeeLeaveBalance.js";

export interface EmployeeLeaveBalanceResult {
  name?: string;
  leaveTypeID?: string;
  balance?: number;
  typeOfUnits?: string;
}

function mapBalance(
  b: NzEmployeeLeaveBalance | UkEmployeeLeaveBalance,
): EmployeeLeaveBalanceResult {
  return {
    name: b.name,
    leaveTypeID: b.leaveTypeID,
    balance: b.balance,
    typeOfUnits: b.typeOfUnits,
  };
}

/**
 * List employee leave balances from Xero Payroll, routing to the correct
 * regional API. AU orgs use leave applications (a different model) and are
 * not supported by this tool.
 */
export async function listXeroPayrollEmployeeLeaveBalances(
  employeeId: string,
): Promise<XeroClientResponse<EmployeeLeaveBalanceResult[]>> {
  try {
    if (!employeeId) {
      throw new Error(
        "Employee ID is required to fetch employee leave balances",
      );
    }

    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    if (region === "AU") {
      return {
        result: null,
        isError: true,
        error:
          "Listing employee leave balances is not supported for AU orgs. AU payroll exposes leave balances on the employee record (via the AU employee API), which is not yet available in this MCP server.",
      };
    }

    const api =
      region === "UK" ? xeroClient.payrollUKApi : xeroClient.payrollNZApi;

    const response = await api.getEmployeeLeaveBalances(
      xeroClient.tenantId,
      employeeId,
      getClientHeaders(),
    );

    const balances = (response.body.leaveBalances ?? []).map(mapBalance);

    return { result: balances, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
