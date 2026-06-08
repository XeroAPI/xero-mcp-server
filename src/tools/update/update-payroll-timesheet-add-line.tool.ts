import { z } from "zod";

import {
  updateXeroPayrollTimesheetAddLine,
  AddTimesheetLineParams,
} from "../../handlers/update-xero-payroll-timesheet-add-line.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const AddTimesheetLineTool = CreateXeroTool(
  "add-timesheet-line",
  `Add a new timesheet line to an existing payroll timesheet in Xero.
Supports AU, NZ, and UK payroll regions. The organisation's region is auto-detected.
For AU payroll, this is the recommended way to add hours. Lines added this way with the same earnings rate are consolidated into a single row in the UI. Add one line per day per earnings rate.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to update."),
    timesheetLine: z.object({
      earningsRateID: z.string().describe("The ID of the earnings rate."),
      numberOfUnits: z.number().describe("The number of units (hours) for this line."),
      date: z.string().describe("The date for the timesheet line (YYYY-MM-DD)."),
      trackingItemID: z.string().optional().describe("Optional tracking category item ID."),
    }).describe("The details of the timesheet line to add."),
  },
  async (params: { timesheetID: string; timesheetLine: { earningsRateID: string; numberOfUnits: number; date: string; trackingItemID?: string } }) => {
    const addParams: AddTimesheetLineParams = {
      timesheetID: params.timesheetID,
      earningsRateID: params.timesheetLine.earningsRateID,
      numberOfUnits: params.timesheetLine.numberOfUnits,
      date: params.timesheetLine.date,
      trackingItemID: params.timesheetLine.trackingItemID,
    };

    const response = await updateXeroPayrollTimesheetAddLine(addParams);

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

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully added timesheet line for earnings rate: ${params.timesheetLine.earningsRateID}`,
        },
      ],
    };
  },
);

export default AddTimesheetLineTool;
