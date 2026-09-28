import { z } from "zod";

import { createXeroPayrollEmployeeLeave } from "../../handlers/create-xero-payroll-employee-leave.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const leavePeriodSchema = z.object({
  periodStartDate: z
    .string()
    .describe("Pay period start date (YYYY-MM-DD).")
    .optional(),
  periodEndDate: z
    .string()
    .describe("Pay period end date (YYYY-MM-DD).")
    .optional(),
  numberOfUnits: z
    .number()
    .describe("Units to take in this period. Overrides Xero's automatic calculation.")
    .optional(),
  numberOfUnitsTaken: z
    .number()
    .describe("Units already taken in this period.")
    .optional(),
});

const CreatePayrollEmployeeLeaveTool = CreateXeroTool(
  "create-payroll-employee-leave",
  `Create a leave request for an employee in Xero Payroll (NZ).
The employee must already have leave setup. Get leaveTypeID from list-payroll-employee-leave-types or list-payroll-leave-types.
Xero calculates the number of units automatically unless you pass periods with numberOfUnits.
This uses the NZ Payroll API (same as list-payroll-employee-leave), not Australian leave applications.`,
  {
    employeeId: z
      .string()
      .describe("The Xero employee ID. Can be obtained from list-payroll-employees."),
    leaveTypeID: z
      .string()
      .describe("The leave type ID. Can be obtained from list-payroll-employee-leave-types or list-payroll-leave-types."),
    description: z
      .string()
      .max(50)
      .describe("Description of the leave request (max 50 characters)."),
    startDate: z.string().describe("Start date of the leave (YYYY-MM-DD)."),
    endDate: z.string().describe("End date of the leave (YYYY-MM-DD)."),
    periods: z
      .array(leavePeriodSchema)
      .optional()
      .describe(
        "Optional pay-period breakdown. Provide this only when you need to override the automatically calculated number of units.",
      ),
  },
  async ({ employeeId, leaveTypeID, description, startDate, endDate, periods }) => {
    const response = await createXeroPayrollEmployeeLeave({
      employeeId,
      leaveTypeID,
      description,
      startDate,
      endDate,
      periods,
    });

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating employee leave: ${response.error}`,
          },
        ],
      };
    }

    const leave = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Employee leave created successfully:",
            `Leave ID: ${leave.leaveID}`,
            `Leave Type ID: ${leave.leaveTypeID}`,
            `Description: ${leave.description}`,
            `Start Date: ${leave.startDate}`,
            `End Date: ${leave.endDate}`,
            leave.periods?.length
              ? `Periods: ${leave.periods.length}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreatePayrollEmployeeLeaveTool;
