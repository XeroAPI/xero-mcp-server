import {
  TimesheetLine,
} from "xero-node/dist/gen/model/payroll-nz/timesheetLine.js";
import { z } from "zod";

import {
  updateXeroPayrollTimesheetAddLine,
} from "../../handlers/update-xero-payroll-timesheet-add-line.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const AddTimesheetLineTool = CreateXeroTool(
  "add-timesheet-line",
  `Add a new timesheet line to an existing payroll timesheet in Xero.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to update."),
    timesheetLine: z.object({
      earningsRateID: z.string().describe("The ID of the earnings rate."),
      numberOfUnits: z.number().describe("The number of units for the timesheet line."),
      date: z.string().describe("The date for the timesheet line (YYYY-MM-DD)."),
    }).describe("The details of the timesheet line to add."),
  },
  async (params: { timesheetID: string; timesheetLine: TimesheetLine }) => {
    const { timesheetID, timesheetLine } = params;
    const response = await updateXeroPayrollTimesheetAddLine(timesheetID, timesheetLine);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error adding timesheet line: ${response.error}`,
          },
        ],
      };
    }

    const newLine = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully added timesheet line with date: ${newLine?.date}`,
        },
      ],
    };
  },
);

export default AddTimesheetLineTool;