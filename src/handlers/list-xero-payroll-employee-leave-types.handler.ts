import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { EmployeeLeaveType as NzEmployeeLeaveType } from "../types/payroll-nz-types.js";
import { EmployeeLeaveType as UkEmployeeLeaveType } from "xero-node/dist/gen/model/payroll-uk/employeeLeaveType.js";

export interface EmployeeLeaveTypeResult {
  leaveTypeID?: string;
  scheduleOfAccrual?: string;
  typeOfUnitsToAccrue?: string;
  unitsAccruedAnnually?: number;
  maximumToAccrue?: number;
  openingBalance?: number;
  rateAccruedHourly?: number;
  scheduleOfAccrualDate?: string;
}

function mapLeaveType(
  t: NzEmployeeLeaveType | UkEmployeeLeaveType,
): EmployeeLeaveTypeResult {
  // UK exposes hoursAccruedAnnually; NZ exposes unitsAccruedAnnually. Normalise to a single field.
  const unitsAccruedAnnually =
    "unitsAccruedAnnually" in t
      ? t.unitsAccruedAnnually
      : (t as UkEmployeeLeaveType).hoursAccruedAnnually;

  // UK only accrues in hours; NZ exposes typeOfUnitsToAccrue (e.g. "Hours", "Days").
  const typeOfUnitsToAccrue =
    "typeOfUnitsToAccrue" in t ? t.typeOfUnitsToAccrue : "Hours";

  return {
    leaveTypeID: t.leaveTypeID,
    scheduleOfAccrual:
      t.scheduleOfAccrual !== undefined
        ? String(t.scheduleOfAccrual)
        : undefined,
    typeOfUnitsToAccrue,
    unitsAccruedAnnually,
    maximumToAccrue: t.maximumToAccrue,
    openingBalance: t.openingBalance,
    rateAccruedHourly: t.rateAccruedHourly,
    scheduleOfAccrualDate: t.scheduleOfAccrualDate,
  };
}

/**
 * List employee leave types from Xero Payroll, routing to the correct regional
 * API. AU orgs use leave applications (a different model) and are not
 * supported by this tool.
 */
export async function listXeroPayrollEmployeeLeaveTypes(
  employeeId: string,
): Promise<XeroClientResponse<EmployeeLeaveTypeResult[]>> {
  try {
    if (!employeeId) {
      throw new Error("Employee ID is required to fetch employee leave types");
    }

    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    if (region === "AU") {
      return {
        result: null,
        isError: true,
        error:
          "Listing employee leave types is not supported for AU orgs. AU payroll exposes leave types as pay items, which are not yet available in this MCP server.",
      };
    }

    const api =
      region === "UK" ? xeroClient.payrollUKApi : xeroClient.payrollNZApi;

    const response = await api.getEmployeeLeaveTypes(
      xeroClient.tenantId,
      employeeId,
      getClientHeaders(),
    );

    const leaveTypes = (response.body.leaveTypes ?? []).map(mapLeaveType);

    return { result: leaveTypes, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
