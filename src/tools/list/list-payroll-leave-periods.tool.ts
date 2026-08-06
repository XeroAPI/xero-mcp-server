import { z } from "zod";
import { listXeroPayrollLeavePeriods } from "../../handlers/list-xero-payroll-leave-periods.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { LeavePeriod } from "../../types/payroll-nz-types.js";

const ListPayrollLeavePeriodsToolTool = CreateXeroTool(
  "list-payroll-leave-periods",
  "List all leave periods for a specific employee in Xero. This shows detailed time off periods including start and end dates, period status, and the number and types of units taken. Provide an employee ID to see their leave periods.",
  {
    employeeId: z.string().describe("The Xero employee ID to fetch leave periods for"),
    startDate: z.string().optional().describe("Optional start date in YYYY-MM-DD format"),
    endDate: z.string().optional().describe("Optional end date in YYYY-MM-DD format"),
  },
  async ({ employeeId, startDate, endDate }) => {
    const response = await listXeroPayrollLeavePeriods(employeeId, startDate, endDate);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing employee leave periods: ${response.error}`,
          },
        ],
      };
    }

    const periods = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${periods?.length || 0} leave periods for employee ${employeeId}:`,
        },
        ...(periods?.map((period: LeavePeriod) => ({
          type: "text" as const,
          text: [
            `Period Status: ${period.periodStatus || "Unknown"}`,
            period.periodStartDate ? `Start Date: ${period.periodStartDate}` : null,
            period.periodEndDate ? `End Date: ${period.periodEndDate}` : null,
            period.numberOfUnits !== undefined ? `Number of Units: ${period.numberOfUnits}` : null,
            period.numberOfUnitsTaken !== undefined ? `Number of Units Taken: ${period.numberOfUnitsTaken}` : null,
            period.typeOfUnits ? `Type of Units: ${period.typeOfUnits}` : null,
            period.typeOfUnitsTaken ? `Type of Units Taken: ${period.typeOfUnitsTaken}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollLeavePeriodsToolTool;
