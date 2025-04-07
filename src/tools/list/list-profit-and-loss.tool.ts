import { z } from "zod";
import { listXeroProfitAndLoss } from "../../handlers/list-xero-profit-and-loss.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { ReportWithRow } from "xero-node";

const ListProfitAndLossTool = CreateXeroTool(
  "list-profit-and-loss",
  "Lists profit and loss report in Xero. This provides a summary of revenue, expenses, and profit or loss over a specified period of time.",
  {
    fromDate: z.string().optional().describe("Optional start date in YYYY-MM-DD format"),
    toDate: z.string().optional().describe("Optional end date in YYYY-MM-DD format"),
    periods: z.number().optional().describe("Optional number of periods to compare"),
    timeframe: z.enum(["MONTH", "QUARTER", "YEAR"]).optional().describe("Optional timeframe for the report (MONTH, QUARTER, YEAR)"),
    trackingCategoryID: z.string().optional().describe("Optional tracking category ID to filter by"),
    trackingOptionID: z.string().optional().describe("Optional tracking option ID (requires trackingCategoryID)"),
    trackingCategoryID2: z.string().optional().describe("Optional second tracking category ID to filter by"),
    trackingOptionID2: z.string().optional().describe("Optional second tracking option ID (requires trackingCategoryID2)"),
    standardLayout: z.boolean().optional().describe("Optional flag to use standard layout"),
    paymentsOnly: z.boolean().optional().describe("Optional flag to include only accounts with payments"),
  },
  async (args) => {
    const response = await listXeroProfitAndLoss(
      args?.fromDate,
      args?.toDate,
      args?.periods,
      args?.timeframe,
      args?.trackingCategoryID,
      args?.trackingOptionID,
      args?.trackingCategoryID2,
      args?.trackingOptionID2,
      args?.standardLayout,
      args?.paymentsOnly
    );

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing profit and loss report: ${response.error}`,
          },
        ],
      };
    }

    const profitAndLoss = response.result;
    const reports = profitAndLoss.reports || [];
    const report = reports[0] as ReportWithRow | undefined;

    return {
      content: [
        {
          type: "text" as const,
          text: `Profit and Loss Report: ${report?.reportName || "Unnamed"}`,
        },
        {
          type: "text" as const,
          text: `Date Range: ${report?.reportDate || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Updated At: ${report?.updatedDateUTC ? report.updatedDateUTC.toISOString() : "Unknown"}`,
        },
        {
          type: "text" as const,
          text: JSON.stringify(profitAndLoss, null, 2),
        },
      ],
    };
  },
);

export default ListProfitAndLossTool; 