import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import {
  listXeroPayrollTimesheets,
} from "../../handlers/list-xero-timesheets.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatPayrollTimesheetLine } from "../../helpers/format-payroll-timesheet-line.js";
import { z } from "zod";

const ListPayrollTimesheetsTool = CreateXeroTool(
  "list-timesheets",
  `List all payroll timesheets in Xero.
This retrieves comprehensive timesheet details including timesheet IDs, employee IDs, status, start and end dates, total hours, timesheet line IDs, and the last updated date.`,
  {
    page: z.number().int().positive().optional().describe("Optional page number for pagination."),
  },
  async ({ page }) => {
    const response = await listXeroPayrollTimesheets(page);

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
          text: `Found ${timesheets?.length || 0} timesheets${page ? ` (page ${page})` : ""}:`,
        },
        ...(timesheets?.map((timesheet: Timesheet) => ({
          type: "text" as const,
          text: [
            timesheet.timesheetID ? `Timesheet ID: ${timesheet.timesheetID}` : null,
            `Employee ID: ${timesheet.employeeID}`,
            timesheet.status ? `Status: ${timesheet.status}` : null,
            `Start Date: ${timesheet.startDate}`,
            `End Date: ${timesheet.endDate}`,
            timesheet.totalHours !== undefined ? `Total Hours: ${timesheet.totalHours}` : null,
            timesheet.updatedDateUTC ? `Last Updated: ${timesheet.updatedDateUTC.toISOString()}` : null,
            timesheet.timesheetLines === undefined
              ? "Timesheet lines: Use get-timesheet for line details."
              : timesheet.timesheetLines.length
                ? `Timesheet lines:\n${timesheet.timesheetLines.map(formatPayrollTimesheetLine).join("\n\n")}`
                : "No timesheet lines",
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollTimesheetsTool;
