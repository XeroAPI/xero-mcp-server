import { z } from "zod";
import { listXeroPayrollEmployeeLeave } from "../../handlers/list-xero-payroll-employee-leave.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { EmployeeLeave } from "xero-node/dist/gen/model/payroll-nz/employeeLeave.js";

const ListPayrollEmployeeLeaveTool = CreateXeroTool(
  "list-payroll-employee-leave",
  "List all leave records for a specific employee in Xero. This shows all leave transactions including approved, pending, and processed time off. Provide an employee ID to see their leave history.",
  {
    employeeId: z.string().describe("The Xero employee ID to fetch leave records for"),
  },
  async ({ employeeId }) => {
    const response = await listXeroPayrollEmployeeLeave(employeeId);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing employee leave: ${response.error}`,
          },
        ],
      };
    }

    const leave = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${leave?.length || 0} leave records for employee ${employeeId}:`,
        },
        ...(leave?.map((leaveItem: EmployeeLeave) => ({
          type: "text" as const,
          text: [
            `Leave ID: ${leaveItem.leaveID || "Unknown"}`,
            `Leave Type: ${leaveItem.leaveTypeID || "Unknown"}`,
            `Description: ${leaveItem.description || "No description"}`,
            leaveItem.startDate ? `Start Date: ${leaveItem.startDate}` : null,
            leaveItem.endDate ? `End Date: ${leaveItem.endDate}` : null,
            leaveItem.periods ? `Periods: ${leaveItem.periods.length || 0}` : null,
            leaveItem.updatedDateUTC ? `Last Updated: ${leaveItem.updatedDateUTC}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollEmployeeLeaveTool;
