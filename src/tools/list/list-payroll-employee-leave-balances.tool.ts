import { z } from "zod";
import { listXeroPayrollEmployeeLeaveBalances } from "../../handlers/list-xero-payroll-employee-leave-balances.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { EmployeeLeaveBalance } from "xero-node/dist/gen/model/payroll-nz/employeeLeaveBalance.js";

const ListPayrollEmployeeLeaveBalancesTool = CreateXeroTool(
  "list-payroll-employee-leave-balances",
  "List all leave balances for a specific employee in Xero. This shows current leave balances for all leave types available to the employee, including annual, sick, and other leave types.",
  {
    employeeId: z.string().describe("The Xero employee ID to fetch leave balances for"),
  },
  async ({ employeeId }) => {
    const response = await listXeroPayrollEmployeeLeaveBalances(employeeId);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing employee leave balances: ${response.error}`,
          },
        ],
      };
    }

    const leaveBalances = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${leaveBalances?.length || 0} leave balances for employee ${employeeId}:`,
        },
        ...(leaveBalances?.map((balance: EmployeeLeaveBalance) => ({
          type: "text" as const,
          text: [
            `Leave Type ID: ${balance.leaveTypeID || "Unknown"}`,
            `Name: ${balance.name || "Unnamed"}`,
            balance.typeOfUnits ? `Type Of Units: ${balance.typeOfUnits}` : null,
            balance.balance !== undefined ? `Current Balance: ${balance.balance}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollEmployeeLeaveBalancesTool;
