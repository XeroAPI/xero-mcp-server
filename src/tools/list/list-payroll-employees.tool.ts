import { Employee } from "xero-node/dist/gen/model/payroll-nz/employee.js"
import { listXeroPayrollEmployees } from "../../handlers/list-xero-payroll-employees.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListPayrollEmployeesTool = CreateXeroTool(
  "list-payroll-employees",
  `List all payroll employees in Xero.
This retrieves comprehensive employee details including names, User IDs, dates of birth, email addresses, gender, phone numbers, start dates, engagement types (Permanent, FixedTerm, or Casual), titles, and when records were last updated.
The response presents a complete overview of all staff currently registered in your Xero payroll, with their personal and employment information. If there are many employees, ask the user if they would like to see more detailed information about specific employees before proceeding.`,
  {},
  async () => {
    const response = await listXeroPayrollEmployees();

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
          text: `Found ${employees?.length || 0} payroll employees:`,
        },
        ...(employees?.map((employee: Employee) => ({
          type: "text" as const,
          text: [
            `Employee: ${employee.employeeID}`,
            employee.email ? `Email: ${employee.email}` : "No email",
            employee.gender ? `Gender: ${employee.gender}` : null,
            employee.phoneNumber ? `Phone: ${employee.phoneNumber}` : null,
            employee.startDate ? `Start Date: ${employee.startDate}` : null,
            employee.engagementType ? `Engagement Type: ${employee.engagementType}` : "No status", // Permanent, FixedTerm, Casual
            employee.title ? `Title: ${employee.title}` : null,
            employee.firstName ? `First Name: ${employee.firstName}` : null,
            employee.lastName ? `Last Name: ${employee.lastName}` : null,
            employee.updatedDateUTC ? `Last Updated: ${employee.updatedDateUTC}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollEmployeesTool;
