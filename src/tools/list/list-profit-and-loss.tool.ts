import { z } from "zod";
import { listXeroProfitAndLoss } from "../../handlers/list-xero-profit-and-loss.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListProfitAndLossTool = CreateXeroTool(
  "list-profit-and-loss",
  "Lists profit and loss report in Xero. This provides a summary of revenue, expenses, and profit or loss over a specified period of time.",
  {
    fromDate: z.string().optional().describe("Optional start date in YYYY-MM-DD format"),
    toDate: z.string().optional().describe("Optional end date in YYYY-MM-DD format"),
    periods: z.number().optional().describe("Optional number of periods to compare"),
    timeframe: z.enum(["MONTH", "QUARTER", "YEAR"]).optional().describe("Optional timeframe for the report (MONTH, QUARTER, YEAR)"),
    standardLayout: z.boolean().optional().describe("Optional flag to use standard layout"),
    paymentsOnly: z.boolean().optional().describe("Optional flag to include only accounts with payments"),
  },
  async (args) => {
    const response = await listXeroProfitAndLoss(
      args?.fromDate,
      args?.toDate,
      args?.periods,
      args?.timeframe,
      args?.standardLayout,
      args?.paymentsOnly,
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

    const profitAndLossReport = response.result;

    return {
      content: [
        {
          type: "text" as const,
         text: `Profit and Loss Report: ${profitAndLossReport?.reportName ?? "Unnamed"}`,
       },
       {
         type: "text" as const,
         text: `Date Range: ${profitAndLossReport?.reportDate ?? "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Updated At: ${profitAndLossReport?.updatedDateUTC ? profitAndLossReport.updatedDateUTC.toISOString() : "Unknown"}`,
        },
        {
          type: "text" as const,
          text: JSON.stringify(profitAndLossReport.rows, null, 2),
        },
      ],
    };
  },
);

export default ListProfitAndLossTool; 