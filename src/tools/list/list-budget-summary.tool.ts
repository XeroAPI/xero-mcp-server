import { z } from "zod";

import { listXeroBudgetSummary } from "../../handlers/list-xero-budget-summary.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatReportContent } from "../../helpers/format-report.js";

const ListBudgetSummaryTool = CreateXeroTool(
  "list-budget-summary",
  `List the Budget Summary report from Xero. Compares budget vs actual across periods.
Needs accounting.reports.read (legacy) or accounting.reports.budgetsummary.read (granular). Those scopes are not added to the default Custom Connection list — set XERO_SCOPES if your app uses granular report scopes.`,
  {
    date: z
      .string()
      .optional()
      .describe("Optional as-at date in YYYY-MM-DD format"),
    periods: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe("Optional number of periods to compare (1-12)"),
    timeframe: z
      .enum(["MONTH", "QUARTER", "YEAR"])
      .optional()
      .describe("Optional period size to compare (MONTH, QUARTER, YEAR)"),
  },
  async ({ date, periods, timeframe }) => {
    const response = await listXeroBudgetSummary({ date, periods, timeframe });

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing budget summary: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: formatReportContent("Budget Summary Report", response.result),
    };
  },
);

export default ListBudgetSummaryTool;
