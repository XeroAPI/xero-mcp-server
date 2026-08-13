import { xeroClient } from "../clients/xero-client.js";
import { xeroApiTenantId } from "../clients/tenant-context.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { Employee } from "../types/payroll-nz-types.js";

async function getPayrollEmployees(): Promise<Employee[]> {
  await xeroClient.authenticate();

  // Call the Employees endpoint from the PayrollNZApi
  const employees = await xeroClient.payrollNZApi.getEmployees(
    xeroApiTenantId(),
    undefined, // page
    undefined, // pageSize
    getClientHeaders(),
  );

  return employees.body.employees ?? [];
}

/**
 * List all payroll employees from Xero
 */
export async function listXeroPayrollEmployees(): Promise<
  XeroClientResponse<Employee[]>
> {
  try {
    const employees = await getPayrollEmployees();

    return {
      result: employees,
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
