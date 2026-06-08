import { NzTimesheet } from "../types/payroll-nz-types.js";
import { AuV2Timesheet } from "../types/payroll-au-v2-types.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface CreateTimesheetParams {
  employeeID: string;
  startDate: string;
  endDate: string;
  payrollCalendarID: string;
  timesheetLines?: Array<{
    earningsRateID: string;
    numberOfUnits: number;
    date: string;
    trackingItemID?: string;
  }>;
}

export async function createXeroPayrollTimesheet(
  params: CreateTimesheetParams,
): Promise<XeroClientResponse<NzTimesheet | AuV2Timesheet | null>> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    const timesheet = {
      payrollCalendarID: params.payrollCalendarID,
      employeeID: params.employeeID,
      startDate: params.startDate,
      endDate: params.endDate,
      timesheetLines: params.timesheetLines?.map((line) => ({
        earningsRateID: line.earningsRateID,
        numberOfUnits: line.numberOfUnits,
        date: line.date,
        trackingItemID: line.trackingItemID,
      })),
    };

    let result: NzTimesheet | AuV2Timesheet | null;

    if (region === "AU") {
      const res = await xeroClient.payrollAUV2Api.createTimesheet(xeroClient.tenantId, timesheet as AuV2Timesheet);
      result = res.body.timesheet ?? null;
    } else if (region === "UK") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await xeroClient.payrollUKApi.createTimesheet(xeroClient.tenantId, timesheet as any);
      result = (res.body.timesheet ?? null) as unknown as NzTimesheet | null;
    } else {
      const res = await xeroClient.payrollNZApi.createTimesheet(xeroClient.tenantId, timesheet as NzTimesheet);
      result = res.body.timesheet ?? null;
    }

    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
