import { z } from "zod";

import {
  approveXeroPayrollTimesheet,
} from "../../handlers/approve-xero-payroll-timesheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ApprovePayrollTimesheetTool = CreateXeroTool(
  "approve-timesheet",
  `Approve a payroll timesheet in Xero by its ID.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to approve."),
    idempotencyKey: z
      .string()
      .min(1)
      .max(128)
      .optional()
      .describe("Optional retry key. Reuse it for the same approval request."),
  },
  async (params: { timesheetID: string; idempotencyKey?: string }) => {
    const { timesheetID, idempotencyKey } = params;
    const response = await approveXeroPayrollTimesheet(timesheetID, idempotencyKey);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error approving timesheet: ${response.error}`,
          },
        ],
      };
    }

    const timesheet = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully approved timesheet with ID: ${timesheet?.timesheetID}`,
        },
      ],
    };
  },
);

export default ApprovePayrollTimesheetTool;
