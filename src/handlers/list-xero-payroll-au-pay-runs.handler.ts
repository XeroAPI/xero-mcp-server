import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { assertAustralianPayroll } from "../helpers/get-payroll-region.js";
import { AuPayRun } from "../types/payroll-au-types.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getPayRuns(page: number): Promise<AuPayRun[]> {
  await assertAustralianPayroll("list-payroll-pay-runs");

  const payRuns = await xeroClient.payrollAUApi.getPayRuns(
    xeroClient.tenantId,
    undefined,
    undefined,
    undefined,
    page,
    getClientHeaders(),
  );

  return payRuns.body.payRuns ?? [];
}

export async function listXeroPayrollAuPayRuns(page = 1): Promise<
  XeroClientResponse<AuPayRun[]>
> {
  try {
    const payRuns = await getPayRuns(page);
    return {
      result: payRuns,
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
