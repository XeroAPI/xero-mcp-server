import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { LeavePeriod as NzLeavePeriod } from "../types/payroll-nz-types.js";
import { LeavePeriod as UkLeavePeriod } from "xero-node/dist/gen/model/payroll-uk/leavePeriod.js";

export interface LeavePeriodResult {
  periodStatus?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  numberOfUnits?: number;
  numberOfUnitsTaken?: number;
  typeOfUnits?: string;
  typeOfUnitsTaken?: string;
}

function mapPeriod(p: NzLeavePeriod | UkLeavePeriod): LeavePeriodResult {
  // UK LeavePeriod omits numberOfUnitsTaken, typeOfUnits and typeOfUnitsTaken.
  const nz = p as NzLeavePeriod;
  return {
    periodStatus:
      p.periodStatus !== undefined ? String(p.periodStatus) : undefined,
    periodStartDate: p.periodStartDate,
    periodEndDate: p.periodEndDate,
    numberOfUnits: p.numberOfUnits,
    numberOfUnitsTaken: nz.numberOfUnitsTaken,
    typeOfUnits: nz.typeOfUnits,
    typeOfUnitsTaken: nz.typeOfUnitsTaken,
  };
}

/**
 * List employee leave periods from Xero Payroll, routing to the correct
 * regional API. AU orgs use leave applications (a different model) and are
 * not supported by this tool.
 */
export async function listXeroPayrollLeavePeriods(
  employeeId: string,
  startDate?: string,
  endDate?: string,
): Promise<XeroClientResponse<LeavePeriodResult[]>> {
  try {
    if (!employeeId) {
      throw new Error("Employee ID is required to fetch leave periods");
    }

    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    if (region === "AU") {
      return {
        result: null,
        isError: true,
        error:
          "Listing leave periods is not supported for AU orgs. AU payroll uses leave applications, which are not yet available in this MCP server.",
      };
    }

    const api =
      region === "UK" ? xeroClient.payrollUKApi : xeroClient.payrollNZApi;

    const response = await api.getEmployeeLeavePeriods(
      xeroClient.tenantId,
      employeeId,
      startDate,
      endDate,
      getClientHeaders(),
    );

    const periods = (response.body.periods ?? []).map(mapPeriod);

    return { result: periods, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
