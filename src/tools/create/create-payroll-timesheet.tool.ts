import { z } from "zod";

import {
  createXeroPayrollTimesheet,
  CreateTimesheetParams,
} from "../../handlers/create-xero-payroll-timesheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreatePayrollTimesheetTool = CreateXeroTool(
  "create-timesheet",
  `Create a new payroll timesheet in Xero.
Supports AU, NZ, and UK payroll regions. The organisation's region is auto-detected.
IMPORTANT: For AU payroll, create the timesheet WITHOUT timesheetLines, then use add-timesheet-line to add lines one at a time. Passing lines at creation time creates separate rows per day in the UI instead of consolidating them by earnings rate.`,
  {
    payrollCalendarID: z.string().describe("The ID of the payroll calendar."),
    employeeID: z.string().describe("The ID of the employee."),
    startDate: z.string().describe("The start date of the timesheet period (YYYY-MM-DD)."),
    endDate: z.string().describe("The end date of the timesheet period (YYYY-MM-DD)."),
    timesheetLines: z
      .array(
        z.object({
          earningsRateID: z.string().describe("The ID of the earnings rate."),
          numberOfUnits: z.number().describe("The number of units (hours) for this line."),
          date: z.string().describe("The date for the timesheet line (YYYY-MM-DD)."),
          trackingItemID: z.string().optional().describe("Optional tracking category item ID."),
        })
      )
      .optional()
      .describe("The lines of the timesheet."),
  },
  async (params: CreateTimesheetParams) => {
    const response = await createXeroPayrollTimesheet(params);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating timesheet: ${response.error}`,
          },
        ],
      };
    }

    const timesheet = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully created timesheet with ID: ${timesheet?.timesheetID}`,
        },
      ],
    };
  },
);

export default CreatePayrollTimesheetTool;
