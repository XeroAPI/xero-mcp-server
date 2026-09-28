import { z } from "zod";
import { listXeroTrialBalance } from "../../handlers/list-xero-trial-balance.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import {
  assessTrialBalanceIntegrity,
  formatIntegrityMessage,
} from "../../helpers/trial-balance-integrity.js";

const ListTrialBalanceTool = CreateXeroTool(
  "list-trial-balance",
  "Lists the Xero trial balance. Debit/Credit are the current-month movement; YTD Debit/YTD Credit are as-at balances. Both pairs must balance exactly or the tool returns Integrity BLOCKED and withholds the report rows. A PASS does not approve the period close.",
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

    const trialBalanceReport = response.result;
    const integrity = assessTrialBalanceIntegrity(trialBalanceReport);

    if (integrity.status === "BLOCKED") {
      return {
        content: [
          {
            type: "text" as const,
            text: formatIntegrityMessage(integrity),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatIntegrityMessage(integrity),
        },
        {
          type: "text" as const,
          text: `Trial Balance Report: ${trialBalanceReport?.reportName || "Unnamed"}`,
        },
        {
          type: "text" as const,
          text: `Date: ${trialBalanceReport?.reportDate || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Updated At: ${trialBalanceReport?.updatedDateUTC ? trialBalanceReport.updatedDateUTC.toISOString() : "Unknown"}`,
        },
        {
          type: "text" as const,
          text: JSON.stringify(trialBalanceReport.rows, null, 2),
        },
      ],
    };
  },
);

export default ListTrialBalanceTool; 