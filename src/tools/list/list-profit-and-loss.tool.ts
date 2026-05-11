import { z } from "zod";
import { listXeroProfitAndLoss } from "../../handlers/list-xero-profit-and-loss.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { ListProfitAndLossParams } from "../../types/list-profit-and-loss-params.js";

const ListProfitAndLossTool = CreateXeroTool(
  "list-profit-and-loss",
  `Lists the profit and loss report from Xero — revenue, expenses, profit/loss over a period.

Supports two modes:
- Single period: pass fromDate and/or toDate (no periods/timeframe). Returns one report.
- Multi-period breakdown: pass periods and timeframe. Returns N+1 reports, one per period.

ACCURACY NOTE — multi-period mode is fanned out internally.
Xero's native multi-period response (timeframe + periods on a single Reports
API call) drops journal-entry-recognized revenue from the non-current
comparison columns, so totals do not reconcile to Xero's web UI. To work
around this, when timeframe + periods are passed, this tool internally
issues N+1 single-period calls (one per period, with explicit fromDate/toDate
and no periods/timeframe) and returns the results as an array. Each per-period
total comes from a single-period response, which does reconcile.

Period boundary rules used by the fan-out:
- MONTH: full calendar months ending in the month containing toDate (or today).
- QUARTER: full calendar quarters ending in the quarter containing toDate.
- YEAR: full calendar years ending in the year containing toDate.
QUARTER and YEAR assume a calendar (Jan-start) fiscal year. If the org's
fiscal year does not start in January, prefer timeframe=MONTH and aggregate
client-side.

Other gotchas:
- paymentsOnly=true switches to cash basis (accrual is the default).
  Cash-basis totals are lower than accrual when invoices are unpaid. Do
  not toggle this on unless explicitly asked for cash-basis numbers.
- Tracking-category filters silently exclude rows. If a category did
  not exist during an earlier period, that period will appear near-zero.

Filters: optionally pass tracking category/option IDs (use list-tracking-categories to find them).`,
  {
    fromDate: z.string().optional().describe("Optional start date in YYYY-MM-DD format. In multi-period mode, ignored — fan-out anchors on toDate."),
    toDate: z.string().optional().describe("Optional end date in YYYY-MM-DD format. In multi-period mode, anchors the most recent period."),
    periods: z.number().optional().describe("Optional number of comparison periods. Combined with timeframe, triggers fan-out into N+1 single-period reports."),
    timeframe: z.enum(["MONTH", "QUARTER", "YEAR"]).optional().describe("Optional timeframe (MONTH, QUARTER, YEAR). Required to trigger multi-period fan-out."),
    trackingCategoryID: z.string().optional().describe("Optional tracking category ID to filter the report by. Use list-tracking-categories to find IDs."),
    trackingCategoryID2: z.string().optional().describe("Optional second tracking category ID for nested filtering."),
    trackingOptionID: z.string().optional().describe("Optional tracking option ID within trackingCategoryID."),
    trackingOptionID2: z.string().optional().describe("Optional tracking option ID within trackingCategoryID2."),
    standardLayout: z.boolean().optional().describe("Optional flag to use standard layout"),
    paymentsOnly: z.boolean().optional().describe("Optional. When true, returns cash-basis totals instead of accrual. Default (omitted/false) is accrual."),
  },
  async (args: ListProfitAndLossParams) => {
    const response = await listXeroProfitAndLoss(args);

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

    const periodReports = response.result;
    const isFannedOut = periodReports.length > 1;

    const blocks: Array<{ type: "text"; text: string }> = [
      {
        type: "text" as const,
        text: `Profit and Loss Report — ${periodReports.length} period${periodReports.length === 1 ? "" : "s"}`,
      },
      {
        type: "text" as const,
        text: `Requested params: ${JSON.stringify(args)}`,
      },
      {
        type: "text" as const,
        text: `Basis: ${args.paymentsOnly ? "Cash (paymentsOnly=true)" : "Accrual"}`,
      },
    ];

    if (isFannedOut) {
      blocks.push({
        type: "text" as const,
        text: "Multi-period mode: each period below was fetched as an INDEPENDENT single-period call (workaround for Xero's multi-period JE-revenue drop). Per-period totals reconcile to Xero's web UI.",
      });
    }

    for (const periodReport of periodReports) {
      const report = periodReport.report;
      const headerRow = report.rows?.find(
        (row) => (row.rowType as unknown as string) === "Header",
      );
      const columnLabels =
        headerRow?.cells?.map(
          (cell, index) => `[${index}] ${cell.value ?? ""}`,
        ) ?? [];

      blocks.push({
        type: "text" as const,
        text: `--- Period: ${periodReport.periodLabel} (${periodReport.fromDate || "?"} to ${periodReport.toDate || "?"}) ---`,
      });
      blocks.push({
        type: "text" as const,
        text: `Report titles: ${(report.reportTitles ?? []).join(" | ") || "Not specified"}`,
      });
      blocks.push({
        type: "text" as const,
        text: `Report generated on: ${report.reportDate ?? "Not specified"}`,
      });
      blocks.push({
        type: "text" as const,
        text: `Updated At: ${report.updatedDateUTC ? report.updatedDateUTC.toISOString() : "Unknown"}`,
      });
      blocks.push({
        type: "text" as const,
        text: `Column index → label: ${columnLabels.length ? columnLabels.join(", ") : "(no header row)"}`,
      });
      blocks.push({
        type: "text" as const,
        text: JSON.stringify(report.rows, null, 2),
      });
    }

    return { content: blocks };
  },
);

export default ListProfitAndLossTool;
