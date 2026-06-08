import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

export async function deleteXeroPayrollTimesheetLine(
  timesheetID: string,
  timesheetLineID: string,
): Promise<XeroClientResponse<boolean>> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    if (region === "AU") {
      await xeroClient.payrollAUV2Api.deleteTimesheetLine(xeroClient.tenantId, timesheetID, timesheetLineID);
    } else if (region === "UK") {
      await xeroClient.payrollUKApi.deleteTimesheetLine(xeroClient.tenantId, timesheetID, timesheetLineID);
    } else {
      await xeroClient.payrollNZApi.deleteTimesheetLine(xeroClient.tenantId, timesheetID, timesheetLineID);
    }

    return { result: true, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
