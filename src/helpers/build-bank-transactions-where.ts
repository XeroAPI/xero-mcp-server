const GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface BankTransactionsFilter {
  bankAccountId?: string;
  /** Inclusive start date, YYYY-MM-DD */
  fromDate?: string;
  /** Inclusive end date, YYYY-MM-DD */
  toDate?: string;
}

export const isGuid = (value: string): boolean => GUID_PATTERN.test(value);

/**
 * Parse a YYYY-MM-DD string into its parts, rejecting impossible dates
 * such as 2026-02-30.
 */
export function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date "${value}". Use a real calendar date in YYYY-MM-DD.`);
  }
  return { year, month, day };
}

const toXeroDateTime = (value: string): string => {
  const { year, month, day } = parseIsoDate(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `DateTime(${year},${pad(month)},${pad(day)})`;
};

/**
 * Build the Xero `where` clause for GET /BankTransactions.
 * Returns undefined when there is nothing to filter on.
 */
export function buildBankTransactionsWhere(
  filter: BankTransactionsFilter,
): string | undefined {
  const { bankAccountId, fromDate, toDate } = filter;
  const clauses: string[] = [];

  if (bankAccountId) {
    if (!isGuid(bankAccountId)) {
      throw new Error(`Invalid bankAccountId "${bankAccountId}". Expected a Xero account GUID.`);
    }
    clauses.push(`BankAccount.AccountID=guid("${bankAccountId}")`);
  }

  // Convert (and so validate) both dates before comparing them.
  const from = fromDate ? toXeroDateTime(fromDate) : undefined;
  const to = toDate ? toXeroDateTime(toDate) : undefined;

  if (fromDate && toDate && fromDate > toDate) {
    throw new Error(`fromDate (${fromDate}) is after toDate (${toDate}).`);
  }

  if (from) {
    clauses.push(`Date >= ${from}`);
  }

  if (to) {
    clauses.push(`Date <= ${to}`);
  }

  return clauses.length > 0 ? clauses.join(" && ") : undefined;
}
