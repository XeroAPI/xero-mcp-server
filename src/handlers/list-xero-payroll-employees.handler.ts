import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { Employee as NzEmployee } from "../types/payroll-nz-types.js";
import { Employee as AuEmployee } from "xero-node/dist/gen/model/payroll-au/employee.js";
import { Employee as UkEmployee } from "xero-node/dist/gen/model/payroll-uk/employee.js";

export interface EmployeeResult {
  employeeID?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string;
  gender?: string;
  phoneNumber?: string;
  startDate?: string;
  engagementType?: string;
  updatedDateUTC?: Date;
}

function mapAuEmployee(e: AuEmployee): EmployeeResult {
  return {
    employeeID: e.employeeID,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    title: e.title,
    gender: e.gender !== undefined ? String(e.gender) : undefined,
    phoneNumber: e.phone,
    startDate: e.startDate,
    updatedDateUTC: e.updatedDateUTC,
  };
}

function mapNzEmployee(e: NzEmployee): EmployeeResult {
  return {
    employeeID: e.employeeID,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    title: e.title,
    gender: e.gender !== undefined ? String(e.gender) : undefined,
    phoneNumber: e.phoneNumber,
    startDate: e.startDate,
    engagementType: e.engagementType,
    updatedDateUTC: e.updatedDateUTC,
  };
}

function mapUkEmployee(e: UkEmployee): EmployeeResult {
  return {
    employeeID: e.employeeID,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    title: e.title,
    gender: e.gender !== undefined ? String(e.gender) : undefined,
    phoneNumber: e.phoneNumber,
    startDate: e.startDate,
    updatedDateUTC: e.updatedDateUTC,
  };
}

/**
 * List all payroll employees from Xero, routing to the correct regional API.
 */
export async function listXeroPayrollEmployees(): Promise<
  XeroClientResponse<EmployeeResult[]>
> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    let employees: EmployeeResult[];

    if (region === "AU") {
      const res = await xeroClient.payrollAUApi.getEmployees(
        xeroClient.tenantId,
        undefined,
        undefined,
        undefined,
        undefined,
        getClientHeaders(),
      );
      employees = (res.body.employees ?? []).map(mapAuEmployee);
    } else if (region === "UK") {
      const res = await xeroClient.payrollUKApi.getEmployees(
        xeroClient.tenantId,
        undefined,
        undefined,
        getClientHeaders(),
      );
      employees = (res.body.employees ?? []).map(mapUkEmployee);
    } else {
      const res = await xeroClient.payrollNZApi.getEmployees(
        xeroClient.tenantId,
        undefined,
        undefined,
        getClientHeaders(),
      );
      employees = (res.body.employees ?? []).map(mapNzEmployee);
    }

    return { result: employees, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
