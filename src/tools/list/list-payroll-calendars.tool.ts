import { z } from "zod";

import {
  listXeroPayrollCalendars,
  ListPayrollCalendarsParams,
  PayrollCalendarResult,
} from "../../handlers/list-xero-payroll-calendars.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListPayrollCalendarsTool = CreateXeroTool(
  "list-payroll-calendars",
  `List all payroll calendars in Xero.
This shows pay calendar names, types, upcoming period start dates, and payment dates.
Supports AU, NZ, and UK payroll regions. The organisation's region is auto-detected.`,
  {
    page: z.number().optional().describe("Page number for pagination."),
  },
  async (params: ListPayrollCalendarsParams) => {
    const response = await listXeroPayrollCalendars(params);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing payroll calendars: ${response.error}`,
          },
        ],
      };
    }

    const calendars = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${calendars?.length || 0} payroll calendars:`,
        },
        ...(calendars?.map((cal: PayrollCalendarResult) => ({
          type: "text" as const,
          text: [
            `Calendar: ${cal.name}`,
            `Calendar ID: ${cal.payrollCalendarID}`,
            `Type: ${cal.calendarType}`,
            `Next Period Start: ${cal.periodStartDate}`,
            cal.periodEndDate ? `Period End: ${cal.periodEndDate}` : null,
            `Payment Date: ${cal.paymentDate}`,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollCalendarsTool;
