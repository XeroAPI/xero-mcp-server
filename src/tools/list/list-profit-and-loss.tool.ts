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
    trackingCategoryID: z.string().optional().describe("Optional tracking category ID to scope the report to a tracking dimension. Obtain IDs from the list-tracking-categories tool. Supply this alone for a per-option breakdown (one column per option in the category); supply it together with trackingOptionID to filter the whole P&L to that single option."),
    trackingOptionID: z.string().optional().describe("Optional tracking option ID. Obtain IDs from the list-tracking-categories tool. Must be supplied together with trackingCategoryID; it filters the whole P&L to that single option of that category."),
    trackingCategoryID2: z.string().optional().describe("Optional SECOND tracking category ID for a cross-tab against a different category. Obtain IDs from the list-tracking-categories tool. This targets a second category (cross-tab), NOT a second option of the same category."),
    trackingOptionID2: z.string().optional().describe("Optional second tracking option ID. Obtain IDs from the list-tracking-categories tool. Must be supplied together with trackingCategoryID2; it filters to that single option of the second category."),
    standardLayout: z.boolean().optional().describe("Optional flag to use standard layout"),
    paymentsOnly: z.boolean().optional().describe("Optional flag to include only accounts with payments"),
  },
  async (args) => {
    const response = await listXeroProfitAndLoss({
      fromDate: args?.fromDate,
      toDate: args?.toDate,
      periods: args?.periods,
      timeframe: args?.timeframe,
      trackingCategoryID: args?.trackingCategoryID,
      trackingOptionID: args?.trackingOptionID,
      trackingCategoryID2: args?.trackingCategoryID2,
      trackingOptionID2: args?.trackingOptionID2,
      standardLayout: args?.standardLayout,
      paymentsOnly: args?.paymentsOnly,
    });

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