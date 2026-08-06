import { z } from "zod";

import {
  getXeroPayrollTimesheet,
} from "../../handlers/get-xero-payroll-timesheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatPayrollTimesheetLine } from "../../helpers/format-payroll-timesheet-line.js";

const GetPayrollTimesheetTool = CreateXeroTool(
  "get-timesheet",
  `Retrieve a single payroll timesheet from Xero by its ID.
This provides details such as the timesheet ID, employee ID, status, start and end dates, total hours, line IDs, and the last updated date.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to retrieve."),
  },
  async (params: { timesheetID: string }) => {
    const { timesheetID } = params;
    const response = await getXeroPayrollTimesheet(timesheetID);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving timesheet: ${response.error}`,
          },
        ],
      };
    }

    const timesheet = response.result;

    if (!timesheet) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No timesheet found with ID: ${timesheetID}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Timesheet ID: ${timesheet.timesheetID}`,
            `Employee ID: ${timesheet.employeeID}`,
            timesheet.status ? `Status: ${timesheet.status}` : null,
            `Start Date: ${timesheet.startDate}`,
            `End Date: ${timesheet.endDate}`,
            `Total Hours: ${timesheet.totalHours}`,
            `Last Updated: ${timesheet.updatedDateUTC}`,
            timesheet.timesheetLines?.length
              ? `Timesheet lines:\n${timesheet.timesheetLines.map(formatPayrollTimesheetLine).join("\n\n")}`
              : "No timesheet lines",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default GetPayrollTimesheetTool;
