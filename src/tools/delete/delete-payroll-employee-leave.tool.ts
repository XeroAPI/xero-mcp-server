import { z } from "zod";

import { deleteXeroPayrollEmployeeLeave } from "../../handlers/delete-xero-payroll-employee-leave.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const DeletePayrollEmployeeLeaveTool = CreateXeroTool(
  "delete-payroll-employee-leave",
  `Delete a leave request for an employee in Xero Payroll (NZ).
Get leaveId from list-payroll-employee-leave. Completed or processed leave often cannot be deleted.
This uses the NZ Payroll API (same as list-payroll-employee-leave), not Australian leave applications.`,
  {
    employeeId: z
      .string()
      .describe("The Xero employee ID. Can be obtained from list-payroll-employees."),
    leaveId: z
      .string()
      .describe("The leave ID to delete. Can be obtained from list-payroll-employee-leave."),
  },
  async ({ employeeId, leaveId }) => {
    const response = await deleteXeroPayrollEmployeeLeave({
      employeeId,
      leaveId,
    });

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting employee leave: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Successfully deleted leave ${leaveId} for employee ${employeeId}.`,
        },
      ],
    };
  },
);

export default DeletePayrollEmployeeLeaveTool;
