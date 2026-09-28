/**
 * Exact trial-balance integrity for Xero Reports/TrialBalance.
 *
 * Debit/Credit cells are the current-month movement; YTD Debit/YTD Credit are
 * the as-at balances. Both pairs must total exactly. Totals are recomputed
 * from account rows; SummaryRow values are ignored. Arithmetic is decimal
 * (scaled BigInt), never IEEE float.
 *
 * PASS means the pairs balance. BLOCKED means the report is truncated,
 * misparsed, or a shape the helper does not recognise. A balanced report
 * still needs human review.
 */

const REQUIRED_COLUMNS = ["Account", "Debit", "Credit", "YTD Debit", "YTD Credit"] as const;

export type ReportCell = {
  value?: string | number | null;
  attributes?: Array<{ id?: string; value?: string }>;
};

export type ReportRow = {
  // xero-node's published .d.ts types RowType as a numeric enum; the generated
  // JS (and the JSON the API sends) is string-valued. Keep this structural.
  rowType?: unknown;
  title?: string;
  cells?: ReportCell[];
  rows?: ReportRow[];
};

export type TrialBalanceReport = {
  reportName?: string;
  reportDate?: string;
  updatedDateUTC?: Date | string;
  rows?: ReportRow[];
};

export type Amount = { n: bigint; scale: number };

export type IntegrityPass = {
  status: "PASS";
  accountRows: number;
  movementDebits: string;
  movementCredits: string;
  ytdDebits: string;
  ytdCredits: string;
};

export type IntegrityBlocked = {
  status: "BLOCKED";
  reason: string;
  accountRows?: number;
  movementDebits?: string;
  movementCredits?: string;
  ytdDebits?: string;
  ytdCredits?: string;
};

export type IntegrityResult = IntegrityPass | IntegrityBlocked;

export function parseAmount(value: unknown): Amount | { error: string } {
  if (value == null) {
    return { n: 0n, scale: 0 };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { error: "report cell is not an amount" };
    }
    return parseAmountString(String(value));
  }
  if (typeof value !== "string") {
    return {
      error: `report cell Value is not text or a number (${typeof value})`,
    };
  }
  const text = value.trim();
  if (text === "") {
    return { n: 0n, scale: 0 };
  }
  return parseAmountString(text);
}

function parseAmountString(text: string): Amount | { error: string } {
  // Report amounts are plain decimals; anything else (including exponents) is refused.
  const match = text.match(/^([+-]?\d+)(?:\.(\d+))?$/);
  if (!match) {
    return { error: `report cell "${shown(text)}" is not an amount` };
  }
  const frac = match[2] ?? "";
  return { n: BigInt(match[1] + frac), scale: frac.length };
}

export function addAmounts(a: Amount, b: Amount): Amount {
  if (a.scale === b.scale) {
    return { n: a.n + b.n, scale: a.scale };
  }
  if (a.scale > b.scale) {
    return { n: a.n + b.n * 10n ** BigInt(a.scale - b.scale), scale: a.scale };
  }
  return { n: b.n + a.n * 10n ** BigInt(b.scale - a.scale), scale: b.scale };
}

export function amountsEqual(a: Amount, b: Amount): boolean {
  const diff = addAmounts(a, { n: -b.n, scale: b.scale });
  return diff.n === 0n;
}

export function formatAmount(amount: Amount): string {
  if (amount.n === 0n) {
    return "0.00";
  }
  const negative = amount.n < 0n;
  const digits = (negative ? -amount.n : amount.n).toString();
  if (amount.scale === 0) {
    return `${negative ? "-" : ""}${digits}.00`;
  }
  const padded = digits.padStart(amount.scale + 1, "0");
  const split = padded.length - amount.scale;
  let frac = padded.slice(split);
  if (frac.length < 2) {
    frac = frac.padEnd(2, "0");
  }
  return `${negative ? "-" : ""}${padded.slice(0, split)}.${frac}`;
}

function shown(text: string): string {
  return [...text].filter((ch) => ch >= " " && ch <= "~").join("").slice(0, 40);
}

function rowTypeName(row: ReportRow): string {
  return typeof row.rowType === "string" ? row.rowType : "";
}

function cellText(cell: ReportCell | undefined, where: string): string | { error: string } {
  if (!cell) {
    return "";
  }
  const value = cell.value;
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return {
    error: `report ${where} has a cell Value that is not text or a number`,
  };
}

function objectList<T>(value: T[] | undefined, where: string, key: string): T[] | { error: string } {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => item == null || typeof item !== "object")) {
    return {
      error: `report ${where} has a ${key} value that is not a list of objects`,
    };
  }
  return value;
}

function headerTitles(header: ReportRow): string[] | { error: string } {
  const cells = objectList(header.cells, "header", "cells");
  if ("error" in cells) {
    return cells;
  }
  const titles: string[] = [];
  for (const cell of cells) {
    const text = cellText(cell, "header");
    if (typeof text !== "string") {
      return text;
    }
    titles.push(text);
  }
  return titles;
}

type Totals = {
  movementDebits: Amount;
  movementCredits: Amount;
  ytdDebits: Amount;
  ytdCredits: Amount;
  accountRows: number;
};

function emptyTotals(): Totals {
  const zero: Amount = { n: 0n, scale: 0 };
  return {
    movementDebits: zero,
    movementCredits: zero,
    ytdDebits: zero,
    ytdCredits: zero,
    accountRows: 0,
  };
}

function addCell(
  totals: Totals,
  field: keyof Omit<Totals, "accountRows">,
  raw: unknown,
): { error: string } | null {
  const parsed = parseAmount(raw);
  if ("error" in parsed) {
    return parsed;
  }
  totals[field] = addAmounts(totals[field], parsed);
  return null;
}

function flattenAndTotal(report: TrialBalanceReport): Totals | { error: string } {
  const top = objectList(report.rows, "top level", "rows");
  if ("error" in top) {
    return top;
  }

  let titles: string[] | null = null;
  const totals = emptyTotals();

  for (const row of top) {
    if (rowTypeName(row) === "Header") {
      const header = headerTitles(row);
      if ("error" in header) {
        return header;
      }
      const missing = REQUIRED_COLUMNS.filter((name) => !header.includes(name));
      if (missing.length > 0) {
        return {
          error: `report is missing expected columns (${missing.join(", ")}). The API shape may have changed, or this is not a trial balance report`,
        };
      }
      titles = header;
      continue;
    }
    if (rowTypeName(row) !== "Section") {
      return { error: `unsupported top-level row type: ${rowTypeName(row)}` };
    }
    const section = shown(row.title ?? "");
    const where = `section "${section}"`;
    const inner = objectList(row.rows, where, "rows");
    if ("error" in inner) {
      return inner;
    }
    if (!titles) {
      return { error: "report has account rows before a Header, or is not a trial balance report" };
    }
    const headerTitlesNow: string[] = titles;
    const debitIdx = headerTitlesNow.indexOf("Debit");
    const creditIdx = headerTitlesNow.indexOf("Credit");
    const ytdDebitIdx = headerTitlesNow.indexOf("YTD Debit");
    const ytdCreditIdx = headerTitlesNow.indexOf("YTD Credit");

    for (const child of inner) {
      if (rowTypeName(child) === "SummaryRow") {
        continue;
      }
      if (rowTypeName(child) !== "Row") {
        return { error: `unsupported row type in ${where}: ${rowTypeName(child)}` };
      }
      const cells = objectList(child.cells, where, "cells");
      if ("error" in cells) {
        return cells;
      }
      if (cells.length !== headerTitlesNow.length) {
        return {
          error: `report ${where} has a row of ${cells.length} cells under ${headerTitlesNow.length} header columns. The API shape may have changed, or this is not a trial balance report`,
        };
      }
      const values: string[] = [];
      for (const cell of cells) {
        const text = cellText(cell, where);
        if (typeof text !== "string") {
          return text;
        }
        values.push(text);
      }
      const debit = addCell(totals, "movementDebits", values[debitIdx]);
      if (debit) return debit;
      const credit = addCell(totals, "movementCredits", values[creditIdx]);
      if (credit) return credit;
      const ytdDebit = addCell(totals, "ytdDebits", values[ytdDebitIdx]);
      if (ytdDebit) return ytdDebit;
      const ytdCredit = addCell(totals, "ytdCredits", values[ytdCreditIdx]);
      if (ytdCredit) return ytdCredit;
      totals.accountRows += 1;
    }
  }

  if (!titles) {
    return { error: "report has no Header row. The API shape may have changed, or this is not a trial balance report" };
  }
  if (totals.accountRows === 0) {
    return { error: "report has no account rows; trial balance integrity cannot be established" };
  }
  return totals;
}

export function assessTrialBalanceIntegrity(report: TrialBalanceReport | null | undefined): IntegrityResult {
  if (!report) {
    return { status: "BLOCKED", reason: "Failed to fetch trial balance data from Xero." };
  }
  const totals = flattenAndTotal(report);
  if ("error" in totals) {
    return { status: "BLOCKED", reason: totals.error };
  }

  const movementOk = amountsEqual(totals.movementDebits, totals.movementCredits);
  const ytdOk = amountsEqual(totals.ytdDebits, totals.ytdCredits);
  const snapshot = {
    accountRows: totals.accountRows,
    movementDebits: formatAmount(totals.movementDebits),
    movementCredits: formatAmount(totals.movementCredits),
    ytdDebits: formatAmount(totals.ytdDebits),
    ytdCredits: formatAmount(totals.ytdCredits),
  };

  if (movementOk && ytdOk) {
    return { status: "PASS", ...snapshot };
  }

  const parts: string[] = [];
  if (!movementOk) {
    parts.push(
      `movement debits ${snapshot.movementDebits} != credits ${snapshot.movementCredits}`,
    );
  }
  if (!ytdOk) {
    parts.push(`YTD debits ${snapshot.ytdDebits} != credits ${snapshot.ytdCredits}`);
  }
  return {
    status: "BLOCKED",
    reason: `Trial balance withheld: ${parts.join("; ")}. The report may be truncated or misparsed.`,
    ...snapshot,
  };
}

export function formatIntegrityMessage(result: IntegrityResult): string {
  if (result.status === "PASS") {
    return (
      `Integrity PASS: movement debits = credits = ${result.movementDebits}; ` +
      `YTD = ${result.ytdDebits} (${result.accountRows} account rows). ` +
      "Balanced totals do not approve the period close."
    );
  }
  return `Integrity BLOCKED: ${result.reason}`;
}
