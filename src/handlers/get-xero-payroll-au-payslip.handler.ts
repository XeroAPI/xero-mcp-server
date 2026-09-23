import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { assertAustralianPayroll } from "../helpers/get-payroll-region.js";
import { AuPayslip } from "../types/payroll-au-types.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getPayslip(payslipID: string): Promise<AuPayslip | null> {
  await assertAustralianPayroll("get-payroll-payslip");

  const response = await xeroClient.payrollAUApi.getPayslip(
    xeroClient.tenantId,
    payslipID,
    getClientHeaders(),
  );
  return response.body.payslip ?? null;
}

export async function getXeroPayrollAuPayslip(
  payslipID: string,
): Promise<XeroClientResponse<AuPayslip | null>> {
  try {
    const payslip = await getPayslip(payslipID);
    return {
      result: payslip,
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
