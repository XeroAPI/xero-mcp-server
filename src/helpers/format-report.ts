import { ReportWithRow } from "xero-node";

export function formatReportContent(
  title: string,
  report: ReportWithRow,
): { type: "text"; text: string }[] {
  return [
    {
      type: "text" as const,
      text: `${title}: ${report.reportName ?? "Unnamed"}`,
    },
    {
      type: "text" as const,
      text: `Date: ${report.reportDate ?? "Not specified"}`,
    },
    {
      type: "text" as const,
      text: `Updated At: ${
        report.updatedDateUTC
          ? report.updatedDateUTC.toISOString()
          : "Unknown"
      }`,
    },
    {
      type: "text" as const,
      text: JSON.stringify(report.rows, null, 2),
    },
  ];
}
