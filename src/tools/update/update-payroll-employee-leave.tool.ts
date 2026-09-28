import { z } from "zod";

import { updateXeroPayrollEmployeeLeave } from "../../handlers/update-xero-payroll-employee-leave.handler.js";
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

const UpdatePayrollEmployeeLeaveTool = CreateXeroTool(
  "update-payroll-employee-leave",
  `Update an existing leave request for an employee in Xero Payroll (NZ).
Unspecified fields are kept from the current leave record. Get leaveId from list-payroll-employee-leave.
Omit periods unless you need to override the automatically calculated number of units.
This uses the NZ Payroll API (same as list-payroll-employee-leave), not Australian leave applications.`,
  {
    employeeId: z
      .string()
      .describe("The Xero employee ID. Can be obtained from list-payroll-employees."),
    leaveId: z
      .string()
      .describe("The leave ID to update. Can be obtained from list-payroll-employee-leave."),
    leaveTypeID: z
      .string()
      .optional()
      .describe("Replacement leave type ID. Can be obtained from list-payroll-employee-leave-types."),
    description: z
      .string()
      .max(50)
      .optional()
      .describe("Replacement description (max 50 characters)."),
    startDate: z
      .string()
      .optional()
      .describe("Replacement start date (YYYY-MM-DD)."),
    endDate: z
      .string()
      .optional()
      .describe("Replacement end date (YYYY-MM-DD)."),
    periods: z
      .array(leavePeriodSchema)
      .optional()
      .describe(
        "Optional pay-period breakdown. Provide this only when you need to override the automatically calculated number of units.",
      ),
  },
  async ({
    employeeId,
    leaveId,
    leaveTypeID,
    description,
    startDate,
    endDate,
    periods,
  }) => {
    const response = await updateXeroPayrollEmployeeLeave({
      employeeId,
      leaveId,
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
            text: `Error updating employee leave: ${response.error}`,
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
            "Employee leave updated successfully:",
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

export default UpdatePayrollEmployeeLeaveTool;
