import { NzTimesheet } from "../types/payroll-nz-types.js";
import { AuV2Timesheet } from "../types/payroll-au-v2-types.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

export async function getXeroPayrollTimesheet(
  timesheetID: string,
): Promise<XeroClientResponse<NzTimesheet | AuV2Timesheet | null>> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    let result: NzTimesheet | AuV2Timesheet | null;

    if (region === "AU") {
      const res = await xeroClient.payrollAUV2Api.getTimesheet(xeroClient.tenantId, timesheetID);
      result = res.body.timesheet ?? null;
    } else if (region === "UK") {
      const res = await xeroClient.payrollUKApi.getTimesheet(xeroClient.tenantId, timesheetID);
      result = (res.body.timesheet ?? null) as unknown as NzTimesheet | null;
    } else {
      const res = await xeroClient.payrollNZApi.getTimesheet(xeroClient.tenantId, timesheetID);
      result = res.body.timesheet ?? null;
    }

    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
