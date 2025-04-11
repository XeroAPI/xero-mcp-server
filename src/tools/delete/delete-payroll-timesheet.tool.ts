import { z } from "zod";

import {
  deleteXeroPayrollTimesheet,
} from "../../handlers/delete-xero-payroll-timesheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeletePayrollTimesheetTool = CreateXeroTool(
  "delete-timesheet",
  `Delete an existing payroll timesheet in Xero by its ID.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to delete."),
  },
  async (params: { timesheetID: string }) => {
    const { timesheetID } = params;
    const response = await deleteXeroPayrollTimesheet(timesheetID);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting timesheet: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully deleted timesheet with ID: ${timesheetID}`,
        },
      ],
    };
  },
);

export default DeletePayrollTimesheetTool;