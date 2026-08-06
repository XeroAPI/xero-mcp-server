import { Employee } from "../../types/payroll-nz-types.js";
import { listXeroPayrollEmployees } from "../../handlers/list-xero-payroll-employees.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { z } from "zod";

const ListPayrollEmployeesTool = CreateXeroTool(
  "list-payroll-employees",
  `List payroll employees in Xero.
This retrieves comprehensive employee details including names, User IDs, dates of birth, email addresses, gender, phone numbers, start dates, engagement types (Permanent, FixedTerm, or Casual), titles, and when records were last updated.
The response presents a page of staff registered in your Xero payroll, with their personal and employment information.`,
  {
    page: z.number().int().positive().optional().describe(
      "Optional page number to retrieve. If not provided, the first page is returned.",
    ),
  },
  async ({ page }) => {
    const response = await listXeroPayrollEmployees(page);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing payroll employees: ${response.error}`,
          },
        ],
      };
    }

    const employees = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${employees?.length || 0} payroll employees${page ? ` (page ${page})` : ""}:`,
        },
        ...(employees?.map((employee: Employee) => ({
          type: "text" as const,
          text: [
            `Employee: ${employee.employeeID}`,
            employee.email ? `Email: ${employee.email}` : "No email",
            employee.gender ? `Gender: ${employee.gender}` : null,
            employee.phoneNumber ? `Phone: ${employee.phoneNumber}` : null,
            employee.startDate ? `Start Date: ${employee.startDate}` : null,
            employee.engagementType
              ? `Engagement Type: ${employee.engagementType}`
              : "No status", // Permanent, FixedTerm, Casual
            employee.title ? `Title: ${employee.title}` : null,
            employee.firstName ? `First Name: ${employee.firstName}` : null,
            employee.lastName ? `Last Name: ${employee.lastName}` : null,
            employee.updatedDateUTC
              ? `Last Updated: ${employee.updatedDateUTC}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollEmployeesTool;
