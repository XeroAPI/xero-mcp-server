import { z } from "zod";
import { listXeroReportBalanceSheet } from "../../handlers/list-xero-report-balance-sheet.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { ListReportBalanceSheetParams } from "../../types/list-report-balance-sheet-params.js";

const ListReportBalanceSheetTool = CreateXeroTool(
  "list-report-balance-sheet",
  `Lists the Balance Sheet report from Xero — assets, liabilities, and equity at a point in time.

ACCURACY WARNING — multi-period responses are not guaranteed to reconcile.
When called with timeframe + periods>1, Xero's Reports API can return
comparison columns whose totals diverge from the same period pulled
individually. This has been verified on the related profit-and-loss
report (journal-entry-recognized revenue is dropped from non-current
columns); the underlying API surface is the same, so prefer single-period
calls when balances must reconcile to the Xero web UI.

When totals must be accurate, call this tool ONCE PER as-of date with
explicit \`date\` (no periods, no timeframe) and aggregate client-side.
Only use the multi-period form for the current-period column or for
rough trend visualization.

Other gotchas:
- paymentsOnly=true switches to cash basis (accrual is the default).
  Cash-basis figures will differ from accrual whenever invoices are
  unpaid. Do not toggle this on unless explicitly asked.
- Tracking-option filters silently exclude rows. If an option did
  not exist on the as-of date, that period will appear near-zero.`,
  {
    date: z.string().optional().describe("Optional as-of date in YYYY-MM-DD format"),
    periods: z.number().optional().describe("Optional number of periods to compare. Avoid when totals must reconcile to Xero — see tool description."),
    timeframe: z.enum(["MONTH", "QUARTER", "YEAR"]).optional().describe("Optional timeframe (MONTH, QUARTER, YEAR). Avoid when totals must reconcile to Xero — see tool description."),
    trackingOptionID1: z.string().optional().describe("Optional tracking option ID 1"),
    trackingOptionID2: z.string().optional().describe("Optional tracking option ID 2"),
    standardLayout: z.boolean().optional().describe("Optional flag to use standard layout"),
    paymentsOnly: z.boolean().optional().describe("Optional. When true, returns cash-basis figures instead of accrual. Default (omitted/false) is accrual."),
  },
  async (args: ListReportBalanceSheetParams) => {
    const response = await listXeroReportBalanceSheet(args);

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

    const report = response.result;
    const headerRow = report?.rows?.find(
      (row) => (row.rowType as unknown as string) === "Header",
    );
    const columnLabels =
      headerRow?.cells?.map((cell, index) => `[${index}] ${cell.value ?? ""}`) ??
      [];
    const isMultiPeriod = (args.periods ?? 0) > 1 && Boolean(args.timeframe);
    const accuracyNote = isMultiPeriod
      ? "WARNING: multi-period response. Comparison columns from the Xero Reports API are not guaranteed to reconcile to the web UI (verified on profit-and-loss). Re-pull each as-of date individually before reporting figures."
      : "Single-period response. Should reconcile to Xero's web UI for accrual basis (or cash basis if paymentsOnly=true).";

    return {
      content: [
        {
          type: "text" as const,
          text: `Balance Sheet Report: ${report?.reportName ?? "Unnamed"}`,
        },
        {
          type: "text" as const,
          text: `Report titles: ${(report?.reportTitles ?? []).join(" | ") || "Not specified"}`,
        },
        {
          type: "text" as const,
          text: `Report generated on: ${report?.reportDate ?? "Not specified"}`,
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
          text: `Basis: ${args.paymentsOnly ? "Cash (paymentsOnly=true)" : "Accrual"}`,
        },
        {
          type: "text" as const,
          text: `Column index → label (use this to map data cells to periods): ${columnLabels.length ? columnLabels.join(", ") : "No header row found"}`,
        },
        {
          type: "text" as const,
          text: accuracyNote,
        },
        {
          type: "text" as const,
          text: JSON.stringify(report?.rows, null, 2),
        },
      ],
    };
  },
);

export default ListReportBalanceSheetTool;
