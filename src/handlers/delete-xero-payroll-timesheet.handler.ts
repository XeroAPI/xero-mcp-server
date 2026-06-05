import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

export async function deleteXeroPayrollTimesheet(
  timesheetID: string,
): Promise<XeroClientResponse<boolean>> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    if (region === "AU") {
      await xeroClient.payrollAUV2Api.deleteTimesheet(xeroClient.tenantId, timesheetID);
    } else if (region === "UK") {
      await xeroClient.payrollUKApi.deleteTimesheet(xeroClient.tenantId, timesheetID);
    } else {
      await xeroClient.payrollNZApi.deleteTimesheet(xeroClient.tenantId, timesheetID);
    }

    return { result: true, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
