import { z } from "zod";
import { listXeroPayrollAuPayRuns } from "../../handlers/list-xero-payroll-au-pay-runs.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { AuPayRun } from "../../types/payroll-au-types.js";

const ListPayrollPayRunsTool = CreateXeroTool(
  "list-payroll-pay-runs",
  `List Australian Payroll AU pay runs.
Includes period dates, payment date, status, and wage/tax/super totals. Use list-payroll-payslips with a payRunID to see employees on a run. Australian organisations only. Requires payroll.payruns (or equivalent) scope.`,
  {
    page: z.number().int().min(1).default(1)
      .describe("Page number, with up to 100 pay runs per page"),
  },
  async ({ page }) => {
    const response = await listXeroPayrollAuPayRuns(page);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing pay runs: ${response.error}`,
          },
        ],
      };
    }

    const payRuns = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${payRuns?.length || 0} pay runs on page ${page}.${payRuns?.length === 100 ? ` Request page ${page + 1} for more results.` : ""}`,
        },
        ...(payRuns?.map((payRun: AuPayRun) => ({
          type: "text" as const,
          text: [
            `Pay Run ID: ${payRun.payRunID}`,
            `Payroll Calendar ID: ${payRun.payrollCalendarID}`,
            payRun.payRunPeriodStartDate
              ? `Period Start: ${payRun.payRunPeriodStartDate}`
              : null,
            payRun.payRunPeriodEndDate
              ? `Period End: ${payRun.payRunPeriodEndDate}`
              : null,
            payRun.paymentDate ? `Payment Date: ${payRun.paymentDate}` : null,
            payRun.payRunStatus
              ? `Status: ${String(payRun.payRunStatus)}`
              : null,
            payRun.wages !== undefined ? `Wages: ${payRun.wages}` : null,
            payRun.tax !== undefined ? `Tax: ${payRun.tax}` : null,
            payRun._super !== undefined ? `Super: ${payRun._super}` : null,
            payRun.netPay !== undefined ? `Net Pay: ${payRun.netPay}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPayrollPayRunsTool;
