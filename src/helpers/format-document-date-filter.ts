function toXeroDateTime(date: string): string {
  return `DateTime(${date.split("-").join(", ")})`;
}

export function formatDocumentDateFilter(
  fromDate?: string,
  toDate?: string,
): string | undefined {
  const clauses: string[] = [];

  if (fromDate) {
    clauses.push(`Date >= ${toXeroDateTime(fromDate)}`);
  }
  if (toDate) {
    clauses.push(`Date <= ${toXeroDateTime(toDate)}`);
  }

  return clauses.length > 0 ? clauses.join(" && ") : undefined;
}
