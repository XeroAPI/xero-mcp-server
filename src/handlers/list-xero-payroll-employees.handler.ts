import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { Employee } from "../types/payroll-nz-types.js";

async function getPayrollEmployees(page?: number): Promise<Employee[]> {
  await xeroClient.authenticate();

  // Call the Employees endpoint from the PayrollNZApi
  const employees = await xeroClient.payrollNZApi.getEmployees(
    xeroClient.tenantId,
    undefined, // filter
    page, // page
    getClientHeaders(),
  );

  return employees.body.employees ?? [];
}

/**
 * List a page of payroll employees from Xero
 */
export async function listXeroPayrollEmployees(page?: number): Promise<
  XeroClientResponse<Employee[]>
> {
  try {
    const employees = await getPayrollEmployees(page);

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
