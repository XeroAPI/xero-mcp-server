import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";

import {
  listXeroPayrollTimesheets,
} from "../../handlers/list-xero-timesheets.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListPayrollTimesheetsTool = CreateXeroTool(
  "list-timesheets",
  `List all payroll timesheets in Xero.
This retrieves comprehensive timesheet details including timesheet IDs, employee IDs, start and end dates, total hours, and the last updated date.`,
  {},
  async () => {
    const response = await listXeroPayrollTimesheets();

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
        ...(timesheets?.map((timesheet: Timesheet) => ({
          type: "text" as const,
          text: [
            `Timesheet ID: ${timesheet.timesheetID}`,
            `Employee ID: ${timesheet.employeeID}`,
            `Start Date: ${timesheet.startDate}`,
            `End Date: ${timesheet.endDate}`,
            `Total Hours: ${timesheet.totalHours}`,
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