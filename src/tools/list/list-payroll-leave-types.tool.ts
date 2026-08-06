import { listXeroPayrollLeaveTypes } from "../../handlers/list-xero-payroll-leave-types.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { LeaveType } from "../../types/payroll-nz-types.js";
import { z } from "zod";

const ListPayrollLeaveTypesTool = CreateXeroTool(
  "list-payroll-leave-types",
  "Lists available leave types in Xero Payroll. This provides information about leave categories configured in your Xero system, including statutory and organization-specific leave types.",
  {
    page: z.number().int().positive().optional().describe(
      "Optional page number to retrieve. If not provided, the first page is returned.",
    ),
  },
  async ({ page }) => {
    const response = await listXeroPayrollLeaveTypes(page);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing payroll leave types: ${response.error}`,
          },
        ],
      };
    }

    const leaveTypes = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${leaveTypes?.length || 0} payroll leave types${page ? ` (page ${page})` : ""}:`,
        },        ...(leaveTypes?.map((leaveType: LeaveType) => ({
          type: "text" as const,
          text: [
            `Leave Type: ${leaveType.name || "Unnamed"}`,
            `Leave Type ID: ${leaveType.leaveTypeID || "Unknown"}`,
            leaveType.isPaidLeave !== undefined ? `Is Paid Leave: ${leaveType.isPaidLeave ? 'Yes' : 'No'}` : null,
            leaveType.showOnPayslip !== undefined ? `Show On Payslip: ${leaveType.showOnPayslip ? 'Yes' : 'No'}` : null,
            leaveType.isActive !== undefined ? `Is Active: ${leaveType.isActive ? 'Yes' : 'No'}` : null,
            leaveType.typeOfUnits ? `Type Of Units: ${leaveType.typeOfUnits}` : null,
            leaveType.typeOfUnitsToAccrue ? `Type Of Units To Accrue: ${leaveType.typeOfUnitsToAccrue}` : null,
            leaveType.updatedDateUTC ? `Last Updated: ${leaveType.updatedDateUTC}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollLeaveTypesTool;
