import { z } from "zod";

import {
  getXeroPayrollTimesheet,
} from "../../handlers/get-xero-payroll-timesheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const GetPayrollTimesheetTool = CreateXeroTool(
  "get-timesheet",
  `Retrieve a single payroll timesheet from Xero by its ID.
This provides details such as the timesheet ID, employee ID, start and end dates, total hours, and the last updated date.
Supports AU, NZ, and UK payroll regions. The organisation's region is auto-detected.`,
  {
    timesheetID: z.string().describe("The ID of the timesheet to retrieve."),
  },
  async (params: { timesheetID: string }) => {
    const { timesheetID } = params;
    const response = await getXeroPayrollTimesheet(timesheetID);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving timesheet: ${response.error}`,
          },
        ],
      };
    }

    const timesheet = response.result;

    if (!timesheet) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No timesheet found with ID: ${timesheetID}`,
          },
        ],
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = timesheet as any;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(ts, null, 2),
        },
      ],
    };
  },
);

export default GetPayrollTimesheetTool;