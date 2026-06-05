import { NzTimesheetLine } from "../types/payroll-nz-types.js";
import { AuV2TimesheetLine } from "../types/payroll-au-v2-types.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface UpdateTimesheetLineParams {
  timesheetID: string;
  timesheetLineID: string;
  earningsRateID: string;
  numberOfUnits: number;
  date: string;
  trackingItemID?: string;
}

export async function updateXeroPayrollTimesheetUpdateLine(
  params: UpdateTimesheetLineParams,
): Promise<XeroClientResponse<NzTimesheetLine | AuV2TimesheetLine | null>> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    const line = {
      earningsRateID: params.earningsRateID,
      numberOfUnits: params.numberOfUnits,
      date: params.date,
      trackingItemID: params.trackingItemID,
    };

    let result: NzTimesheetLine | AuV2TimesheetLine | null;

    if (region === "AU") {
      const res = await xeroClient.payrollAUV2Api.updateTimesheetLine(xeroClient.tenantId, params.timesheetID, params.timesheetLineID, line as AuV2TimesheetLine);
      result = res.body.timesheetLine ?? null;
    } else if (region === "UK") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await xeroClient.payrollUKApi.updateTimesheetLine(xeroClient.tenantId, params.timesheetID, params.timesheetLineID, line as any);
      result = (res.body.timesheetLine ?? null) as unknown as NzTimesheetLine | null;
    } else {
      const res = await xeroClient.payrollNZApi.updateTimesheetLine(xeroClient.tenantId, params.timesheetID, params.timesheetLineID, line as NzTimesheetLine);
      result = res.body.timesheetLine ?? null;
    }

    return { result, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
