export const formatAgedReportFilter = (fromDate?: string, toDate?: string): string | undefined => {
  if (!fromDate && !toDate) {
    return undefined;
  }

  const formattedFromDate = fromDate ? `from ${fromDate}` : ""
  const formattedToDate = toDate ? `to ${toDate}` : ""

  return `Showing invoices ${formattedFromDate} ${formattedToDate}`;
};
