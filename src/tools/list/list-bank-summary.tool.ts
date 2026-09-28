import { z } from "zod";

import { listXeroBankSummary } from "../../handlers/list-xero-bank-summary.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatReportContent } from "../../helpers/format-report.js";

const ListBankSummaryTool = CreateXeroTool(
  "list-bank-summary",
  `List the Bank Summary report from Xero. Shows opening balance, cash received, cash spent, and closing balance for each bank account in a date range.
Needs accounting.reports.read (legacy) or accounting.reports.banksummary.read (granular). Those scopes are not added to the default Custom Connection list — set XERO_SCOPES if your app uses granular report scopes.`,
  {
    fromDate: z
      .string()
      .optional()
      .describe("Optional start date in YYYY-MM-DD format"),
    toDate: z
      .string()
      .optional()
      .describe("Optional end date in YYYY-MM-DD format"),
  },
  async ({ fromDate, toDate }) => {
    const response = await listXeroBankSummary({ fromDate, toDate });

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing bank summary: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: formatReportContent("Bank Summary Report", response.result),
    };
  },
);

export default ListBankSummaryTool;
