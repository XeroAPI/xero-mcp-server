import { z } from "zod";

import {
  approveXeroPayrollTimesheet,
} from "../../handlers/approve-xero-payroll-timesheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { ToolScopes } from "../../helpers/scopes.js";

const ApprovePayrollTimesheetTool = CreateXeroTool(
  "approve-timesheet",
  `Approve a payroll timesheet in Xero by its ID.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to approve."),
  },
  async (params: { timesheetID: string }) => {
    const { timesheetID } = params;
    const response = await approveXeroPayrollTimesheet(timesheetID);

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
  ToolScopes.payrollTimesheets
);

export default ApprovePayrollTimesheetTool;