import { z } from "zod";

import {
  revertXeroPayrollTimesheet,
} from "../../handlers/revert-xero-payroll-timesheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const RevertPayrollTimesheetTool = CreateXeroTool(
  "revert-timesheet",
  `Revert a payroll timesheet to draft in Xero by its ID.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to revert."),
    idempotencyKey: z
      .string()
      .min(1)
      .max(128)
      .optional()
      .describe("Optional retry key. Reuse it for the same revert request."),
  },
  async (params: { timesheetID: string; idempotencyKey?: string }) => {
    const { timesheetID, idempotencyKey } = params;
    const response = await revertXeroPayrollTimesheet(timesheetID, idempotencyKey);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reverting timesheet: ${response.error}`,
          },
        ],
      };
    }

    const timesheet = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully reverted timesheet with ID: ${timesheet?.timesheetID} to draft.`,
        },
      ],
    };
  },
);

export default RevertPayrollTimesheetTool;
