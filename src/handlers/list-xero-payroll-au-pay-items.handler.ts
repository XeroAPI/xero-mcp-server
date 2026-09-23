import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { assertAustralianPayroll } from "../helpers/get-payroll-region.js";
import { AuPayItem } from "../types/payroll-au-types.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getPayItems(): Promise<AuPayItem | null> {
  await assertAustralianPayroll("list-payroll-pay-items");

  const response = await xeroClient.payrollAUApi.getPayItems(
    xeroClient.tenantId,
    undefined,
    undefined,
    undefined,
    undefined,
    getClientHeaders(),
  );
  return response.body.payItems ?? null;
}

export async function listXeroPayrollAuPayItems(): Promise<
  XeroClientResponse<AuPayItem | null>
> {
  try {
    const payItems = await getPayItems();
    return {
      result: payItems,
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
