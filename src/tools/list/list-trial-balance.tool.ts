import { z } from "zod";
import { listXeroTrialBalance } from "../../handlers/list-xero-trial-balance.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { ReportWithRow } from "xero-node";

const ListTrialBalanceTool = CreateXeroTool(
  "list-trial-balance",
  "Lists trial balance in Xero. This provides a snapshot of the general ledger, showing debit and credit balances for each account.",
  {
    date: z.string().optional().describe("Optional date in YYYY-MM-DD format"),
    paymentsOnly: z.boolean().optional().describe("Optional flag to include only accounts with payments"),
  },
  async (args) => {
    const response = await listXeroTrialBalance(args?.date, args?.paymentsOnly);
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing trial balance: ${response.error}`,
          },
        ],
      };
    }

    const trialBalance = response.result;
    const reports = trialBalance.reports || [];
    const report = reports[0] as ReportWithRow | undefined;

    return {
      content: [
        {
          type: "text" as const,
          text: `Trial Balance Report: ${report?.reportName || "Unnamed"}`,
        },
        {
          type: "text" as const,
          text: `Date: ${report?.reportDate || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Updated At: ${report?.updatedDateUTC ? report.updatedDateUTC.toISOString() : "Unknown"}`,
        },
        {
          type: "text" as const,
          text: JSON.stringify(trialBalance, null, 2),
        },
      ],
    };
  },
);

export default ListTrialBalanceTool; 