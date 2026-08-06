import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import {
  listXeroPayrollTimesheets,
} from "../../handlers/list-xero-timesheets.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { z } from "zod";

const ListPayrollTimesheetsTool = CreateXeroTool(
  "list-timesheets",
  `List all payroll timesheets in Xero.
This retrieves comprehensive timesheet details including timesheet IDs, employee IDs, start and end dates, total hours, and the last updated date.`,
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
            `Start Date: ${timesheet.startDate}`,
            `End Date: ${timesheet.endDate}`,
            timesheet.totalHours !== undefined ? `Total Hours: ${timesheet.totalHours}` : null,
            timesheet.updatedDateUTC ? `Last Updated: ${timesheet.updatedDateUTC.toISOString()}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollTimesheetsTool;
