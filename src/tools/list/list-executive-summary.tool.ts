import { z } from "zod";

import { listXeroExecutiveSummary } from "../../handlers/list-xero-executive-summary.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatReportContent } from "../../helpers/format-report.js";

const ListExecutiveSummaryTool = CreateXeroTool(
  "list-executive-summary",
  `List the Executive Summary report from Xero. A one-page snapshot of cash, profit and loss, and balance-sheet highlights as at a date.
Needs accounting.reports.read (legacy) or accounting.reports.executivesummary.read (granular). Those scopes are not added to the default Custom Connection list — set XERO_SCOPES if your app uses granular report scopes.`,
  {
    date: z
      .string()
      .optional()
      .describe("Optional as-at date in YYYY-MM-DD format"),
  },
  async ({ date }) => {
    const response = await listXeroExecutiveSummary({ date });

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing executive summary: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: formatReportContent("Executive Summary Report", response.result),
    };
  },
);

export default ListExecutiveSummaryTool;
