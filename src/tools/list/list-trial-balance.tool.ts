import { z } from "zod";
import { listXeroTrialBalance } from "../../handlers/list-xero-trial-balance.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListTrialBalanceTool = CreateXeroTool(
  "list-trial-balance",
  `Lists the trial balance in Xero — debit and credit balances for each general-ledger account as of a single date.

This is a point-in-time snapshot (single column). It does not have the
multi-period accuracy issues that affect profit-and-loss and balance-sheet
comparison columns.

Gotchas:
- paymentsOnly=true switches to cash basis (accrual is the default).
  Cash-basis figures will differ from accrual whenever invoices are
  unpaid. Do not toggle this on unless explicitly asked.
- The "date" param is the as-of date for the snapshot. If omitted, Xero
  defaults to today.`,
  {
    date: z.string().optional().describe("Optional as-of date in YYYY-MM-DD format. Defaults to today if omitted."),
    paymentsOnly: z.boolean().optional().describe("Optional. When true, returns cash-basis balances instead of accrual. Default (omitted/false) is accrual."),
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

    const report = response.result;
    const headerRow = report?.rows?.find(
      (row) => (row.rowType as unknown as string) === "Header",
    );
    const columnLabels =
      headerRow?.cells?.map((cell, index) => `[${index}] ${cell.value ?? ""}`) ??
      [];

    return {
      content: [
        {
          type: "text" as const,
          text: `Trial Balance Report: ${report?.reportName ?? "Unnamed"}`,
        },
        {
          type: "text" as const,
          text: `Report titles: ${(report?.reportTitles ?? []).join(" | ") || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `As-of date: ${report?.reportDate ?? "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Updated At: ${report?.updatedDateUTC ? report.updatedDateUTC.toISOString() : "Unknown"}`,
        },
        {
          type: "text" as const,
          text: `Requested params: ${JSON.stringify(args)}`,
        },
        {
          type: "text" as const,
          text: `Basis: ${args?.paymentsOnly ? "Cash (paymentsOnly=true)" : "Accrual"}`,
        },
        {
          type: "text" as const,
          text: `Column index → label: ${columnLabels.length ? columnLabels.join(", ") : "No header row found"}`,
        },
        {
          type: "text" as const,
          text: JSON.stringify(report?.rows, null, 2),
        },
      ],
    };
  },
);

export default ListTrialBalanceTool;
