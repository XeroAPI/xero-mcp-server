import { Timesheet } from "xero-node/dist/gen/model/payroll-nz/timesheet.js";
import { z } from "zod";

import {
  createXeroPayrollTimesheet,
} from "../../handlers/create-xero-payroll-timesheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreatePayrollTimesheetTool = CreateXeroTool(
  "create-timesheet",
  `Create a new payroll timesheet in Xero.
This allows you to specify details such as the employee ID, payroll calendar ID, start and end dates, and timesheet lines.`,
  {
    payrollCalendarID: z.string().describe("The ID of the payroll calendar."),
    employeeID: z.string().describe("The ID of the employee."),
    startDate: z.string().describe("The start date of the timesheet period (YYYY-MM-DD)."),
    endDate: z.string().describe("The end date of the timesheet period (YYYY-MM-DD)."),
    timesheetLines: z
      .array(
        z.object({
          earningsRateID: z.string().describe("The ID of the earnings rate."),
          numberOfUnits: z.number().describe("The number of units for the timesheet line."),
          date: z.string().describe("The date for the timesheet line (YYYY-MM-DD)."),
        })
      )
      .optional()
      .describe("The lines of the timesheet."),
  },
  async (params: Timesheet) => {
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