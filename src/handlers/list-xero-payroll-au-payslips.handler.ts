import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { assertAustralianPayroll } from "../helpers/get-payroll-region.js";
import { AuPayslipSummary } from "../types/payroll-au-types.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getPayslips(payRunID: string): Promise<AuPayslipSummary[]> {
  await assertAustralianPayroll("list-payroll-payslips");

  const payRuns = await xeroClient.payrollAUApi.getPayRun(
    xeroClient.tenantId,
    payRunID,
    getClientHeaders(),
  );
  const payRun = payRuns.body.payRuns?.[0];
  return payRun?.payslips ?? [];
}

export async function listXeroPayrollAuPayslips(
  payRunID: string,
): Promise<XeroClientResponse<AuPayslipSummary[]>> {
  try {
    const payslips = await getPayslips(payRunID);
    return {
      result: payslips,
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
