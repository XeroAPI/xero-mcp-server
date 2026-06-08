import { PayRunCalendar } from "../types/payroll-nz-types.js";
import { AuPayrollCalendar } from "../types/payroll-au-types.js";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface PayrollCalendarResult {
  payrollCalendarID: string;
  name: string;
  calendarType: string;
  periodStartDate: string;
  periodEndDate?: string;
  paymentDate: string;
}

export interface ListPayrollCalendarsParams {
  page?: number;
}

export async function listXeroPayrollCalendars(
  params: ListPayrollCalendarsParams = {},
): Promise<XeroClientResponse<PayrollCalendarResult[]>> {
  try {
    await xeroClient.authenticate();
    const region = await xeroClient.getRegion();

    let calendars: PayrollCalendarResult[];

    if (region === "AU") {
      const res = await xeroClient.payrollAUApi.getPayrollCalendars(
        xeroClient.tenantId,
        undefined,
        undefined,
        undefined,
        params.page,
      );

      calendars = (res.body.payrollCalendars ?? []).map((c: AuPayrollCalendar) => ({
        payrollCalendarID: c.payrollCalendarID ?? "",
        name: c.name ?? "",
        calendarType: String(c.calendarType ?? ""),
        periodStartDate: c.startDate ?? "",
        paymentDate: c.paymentDate ?? "",
      }));
    } else {
      const api = region === "UK" ? xeroClient.payrollUKApi : xeroClient.payrollNZApi;
      const res = await api.getPayRunCalendars(xeroClient.tenantId, params.page);

      calendars = ((res.body.payRunCalendars ?? []) as PayRunCalendar[]).map((c) => ({
        payrollCalendarID: c.payrollCalendarID ?? "",
        name: c.name ?? "",
        calendarType: String(c.calendarType ?? ""),
        periodStartDate: c.periodStartDate ?? "",
        periodEndDate: c.periodEndDate,
        paymentDate: c.paymentDate ?? "",
      }));
    }

    return { result: calendars, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
