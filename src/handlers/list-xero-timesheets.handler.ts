import { NzTimesheet } from "../types/payroll-nz-types.js";
import { AuV2Timesheet } from "../types/payroll-au-v2-types.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface ListTimesheetsParams {
  page?: number;
  filter?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
}

export async function listXeroPayrollTimesheets(
  params: ListTimesheetsParams = {},
): Promise<XeroClientResponse<(NzTimesheet | AuV2Timesheet)[]>> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    const args = [
      xeroClient.tenantId,
      params.page,
      params.filter,
      params.status,
      params.startDate,
      params.endDate,
      params.sort,
    ] as const;

    let timesheets: (NzTimesheet | AuV2Timesheet)[];

    if (region === "AU") {
      const res = await xeroClient.payrollAUV2Api.getTimesheets(...args);
      timesheets = res.body.timesheets ?? [];
    } else if (region === "UK") {
      const res = await xeroClient.payrollUKApi.getTimesheets(...args);
      timesheets = (res.body.timesheets ?? []) as unknown as NzTimesheet[];
    } else {
      const res = await xeroClient.payrollNZApi.getTimesheets(...args);
      timesheets = res.body.timesheets ?? [];
    }

    return { result: timesheets, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
