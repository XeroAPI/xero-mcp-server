import { z } from "zod";

import {
  deleteXeroPayrollTimesheetLine,
} from "../../handlers/delete-xero-payroll-timesheet-line.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeletePayrollTimesheetLineTool = CreateXeroTool(
  "delete-timesheet-line",
  `Delete a specific line from a payroll timesheet in Xero.
Supports AU, NZ, and UK payroll regions. The organisation's region is auto-detected.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet containing the line."),
    timesheetLineID: z.string().describe("The ID of the timesheet line to delete."),
  },
  async (params: { timesheetID: string; timesheetLineID: string }) => {
    const response = await deleteXeroPayrollTimesheetLine(params.timesheetID, params.timesheetLineID);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting timesheet line: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully deleted timesheet line with ID: ${params.timesheetLineID}`,
        },
      ],
    };
  },
);

export default DeletePayrollTimesheetLineTool;
