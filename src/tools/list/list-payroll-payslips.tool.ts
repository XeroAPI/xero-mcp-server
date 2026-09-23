import { z } from "zod";

import { listXeroPayrollAuPayslips } from "../../handlers/list-xero-payroll-au-payslips.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { AuPayslipSummary } from "../../types/payroll-au-types.js";

const ListPayrollPayslipsTool = CreateXeroTool(
  "list-payroll-payslips",
  `List payslip summaries on an Australian Payroll AU pay run.
Shows wages, tax, super and net pay per employee. Use get-payroll-payslip for earnings and superannuation lines. Australian organisations only. Requires payroll.payruns and payroll.payslip scopes.`,
  {
    payRunID: z
      .string()
      .describe("The Payroll AU pay run ID whose payslips should be listed."),
  },
  async ({ payRunID }: { payRunID: string }) => {
    const response = await listXeroPayrollAuPayslips(payRunID);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing payslips: ${response.error}`,
          },
        ],
      };
    }

    const payslips = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${payslips?.length || 0} payslips on pay run ${payRunID}:`,
        },
        ...(payslips?.map((payslip: AuPayslipSummary) => ({
          type: "text" as const,
          text: [
            `Payslip ID: ${payslip.payslipID}`,
            `Employee ID: ${payslip.employeeID}`,
            [payslip.firstName, payslip.lastName].filter(Boolean).join(" ")
              ? `Name: ${[payslip.firstName, payslip.lastName].filter(Boolean).join(" ")}`
              : null,
            payslip.wages !== undefined ? `Wages: ${payslip.wages}` : null,
            payslip.tax !== undefined ? `Tax: ${payslip.tax}` : null,
            payslip._super !== undefined ? `Super: ${payslip._super}` : null,
            payslip.netPay !== undefined ? `Net Pay: ${payslip.netPay}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollPayslipsTool;
