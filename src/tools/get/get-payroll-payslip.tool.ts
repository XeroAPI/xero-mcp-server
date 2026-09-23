import { z } from "zod";

import { getXeroPayrollAuPayslip } from "../../handlers/get-xero-payroll-au-payslip.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const GetPayrollPayslipTool = CreateXeroTool(
  "get-payroll-payslip",
  `Retrieve one Australian Payroll AU payslip by ID, including earnings lines and superannuation lines (membership, contribution type, amount, payment date). Australian organisations only. Requires payroll.payslip scope. Read-only — does not post or approve pay runs.`,
  {
    payslipID: z.string().describe("The Payroll AU payslip ID to retrieve."),
  },
  async ({ payslipID }: { payslipID: string }) => {
    const response = await getXeroPayrollAuPayslip(payslipID);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving payslip: ${response.error}`,
          },
        ],
      };
    }

    const payslip = response.result;

    if (!payslip) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No payslip found with ID: ${payslipID}`,
          },
        ],
      };
    }

    const superLines =
      payslip.superannuationLines
        ?.map((line) =>
          [
            `  Super membership: ${line.superMembershipID ?? "unknown"}`,
            line.contributionType
              ? `  Contribution type: ${String(line.contributionType)}`
              : null,
            line.percentage !== undefined
              ? `  Percentage: ${line.percentage}`
              : null,
            line.amount !== undefined ? `  Amount: ${line.amount}` : null,
            line.paymentDateForThisPeriod
              ? `  Payment date: ${line.paymentDateForThisPeriod}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n") || "  None";

    const earningsLines =
      payslip.earningsLines
        ?.map((line) =>
          [
            `  Earnings rate: ${line.earningsRateID}`,
            line.amount !== undefined ? `  Amount: ${line.amount}` : null,
            line.numberOfUnits !== undefined
              ? `  Units: ${line.numberOfUnits}`
              : null,
            line.ratePerUnit !== undefined
              ? `  Rate per unit: ${line.ratePerUnit}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n") || "  None";

    return {
      content: [
        {
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
            "Earnings lines:",
            earningsLines,
            "Superannuation lines:",
            superLines,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default GetPayrollPayslipTool;
