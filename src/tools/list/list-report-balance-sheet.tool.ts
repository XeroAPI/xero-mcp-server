import { z } from "zod";
import { listXeroReportBalanceSheet } from "../../handlers/list-xero-report-balance-sheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { ListReportBalanceSheetParams } from "../../types/list-report-balance-sheet-params.js";

const ListReportBalanceSheetTool = CreateXeroTool(
  "list-report-balance-sheet",
  "List the Balance Sheet report from Xero.",
  {
    date: z.string().optional().describe("Optional date in YYYY-MM-DD format"),
    periods: z.number().optional().describe("Optional number of periods to compare"),
    timeframe: z.enum(["MONTH", "QUARTER", "YEAR"]).optional().describe("Optional timeframe for the report (MONTH, QUARTER, YEAR)"),
    trackingOptionID1: z.string().optional().describe("Optional tracking option ID 1"),
    trackingOptionID2: z.string().optional().describe("Optional tracking option ID 2"),
    standardLayout: z.boolean().optional().describe("Optional flag to use standard layout"),
    paymentsOnly: z.boolean().optional().describe("Optional flag to include only accounts with payments"),
  },
  async (args: ListReportBalanceSheetParams) => {
    const response = await listXeroReportBalanceSheet(args);

    // Check if the response contains an error
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing balance sheet report: ${response.error}`,
          },
        ],
      };
    }

    const balanceSheetReport = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Balance sheet Report: ${balanceSheetReport?.reportName ?? "Unnamed"}`,
        },
        {
          type: "text" as const,
          text: JSON.stringify(balanceSheetReport.rows, null, 2),
        },
      ],
    };
  }
);

export default ListReportBalanceSheetTool;