type AgedReportDocument = "bills" | "invoices";

export const formatAgedReportFilter = (
  fromDate?: string,
  toDate?: string,
  document: AgedReportDocument = "invoices",
): string | undefined => {
  if (!fromDate && !toDate) {
    return undefined;
  }

  const dateRange = [
    fromDate ? `from ${fromDate}` : null,
    toDate ? `to ${toDate}` : null,
  ]
    .filter((value): value is string => value !== null)
    .join(" ");

  return `Showing ${document} ${dateRange}`;
};
