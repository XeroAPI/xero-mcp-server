import { z } from "zod";

import {
  updateXeroPayrollTimesheetUpdateLine,
  UpdateTimesheetLineParams,
} from "../../handlers/update-xero-payroll-timesheet-update-line.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const UpdatePayrollTimesheetLineTool = CreateXeroTool(
  "update-timesheet-line",
  `Update an existing timesheet line in a payroll timesheet in Xero.
Supports AU, NZ, and UK payroll regions. The organisation's region is auto-detected.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to update."),
    timesheetLineID: z.string().describe("The ID of the timesheet line to update."),
    timesheetLine: z.object({
      earningsRateID: z.string().describe("The ID of the earnings rate."),
      numberOfUnits: z.number().describe("The number of units (hours) for this line."),
      date: z.string().describe("The date for the timesheet line (YYYY-MM-DD)."),
      trackingItemID: z.string().optional().describe("Optional tracking category item ID."),
    }).describe("The details of the timesheet line to update."),
  },
  async (params: { timesheetID: string; timesheetLineID: string; timesheetLine: { earningsRateID: string; numberOfUnits: number; date: string; trackingItemID?: string } }) => {
    const updateParams: UpdateTimesheetLineParams = {
      timesheetID: params.timesheetID,
      timesheetLineID: params.timesheetLineID,
      earningsRateID: params.timesheetLine.earningsRateID,
      numberOfUnits: params.timesheetLine.numberOfUnits,
      date: params.timesheetLine.date,
      trackingItemID: params.timesheetLine.trackingItemID,
    };

    const response = await updateXeroPayrollTimesheetUpdateLine(updateParams);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating timesheet line: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully updated timesheet line for earnings rate: ${params.timesheetLine.earningsRateID}`,
        },
      ],
    };
  },
);

export default UpdatePayrollTimesheetLineTool;
