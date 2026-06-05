import { z } from "zod";

import {
  listXeroPayrollTimesheets,
  ListTimesheetsParams,
} from "../../handlers/list-xero-timesheets.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListPayrollTimesheetsTool = CreateXeroTool(
  "list-timesheets",
  `List all payroll timesheets in Xero.
This retrieves comprehensive timesheet details including timesheet IDs, employee IDs, start and end dates, total hours, and the last updated date.
Supports AU, NZ, and UK payroll regions. The organisation's region is auto-detected.`,
  {
    page: z.number().optional().describe("Page number for pagination."),
    filter: z.string().optional().describe("Filter by employeeId and/or payrollCalendarId."),
    status: z.string().optional().describe("Filter by timesheet status (Draft, Approved, Completed)."),
    startDate: z.string().optional().describe("Return timesheets with startDate on or after this date (YYYY-MM-DD)."),
    endDate: z.string().optional().describe("Return timesheets with endDate on or before this date (YYYY-MM-DD)."),
    sort: z.string().optional().describe("Sort order: createdDate (default) or startDate."),
  },
  async (params: ListTimesheetsParams) => {
    const response = await listXeroPayrollTimesheets(params);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing timesheets: ${response.error}`,
          },
        ],
      };
    }

    const timesheets = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${timesheets?.length || 0} timesheets:`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(timesheets?.map((timesheet: any) => ({
          type: "text" as const,
          text: [
            `Timesheet ID: ${timesheet.timesheetID}`,
            `Employee ID: ${timesheet.employeeID}`,
            `Start Date: ${timesheet.startDate}`,
            `End Date: ${timesheet.endDate}`,
            `Status: ${timesheet.status}`,
            `Total Hours: ${timesheet.totalHours ?? "N/A"}`,
            `Last Updated: ${timesheet.updatedDateUTC}`,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollTimesheetsTool;
