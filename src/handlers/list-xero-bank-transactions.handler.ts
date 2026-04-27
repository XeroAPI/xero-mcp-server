import { xeroClient } from "../clients/xero-client.js";
import { BankTransaction } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface ListBankTransactionsParams {
  page?: number;
  pageSize?: number;
  bankAccountId?: string;
  bankTransactionIds?: string[];
  contactIds?: string[];
  types?: string[];
  statuses?: string[];
  fromDate?: string;
  toDate?: string;
  where?: string;
  order?: string;
  modifiedAfter?: string;
}

const GUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

class ValidationError extends Error {}

function assertGuid(value: string, fieldName: string): void {
  if (!GUID_RE.test(value)) {
    throw new ValidationError(
      `Invalid GUID for ${fieldName}: ${JSON.stringify(value)}. Expected format: 00000000-0000-0000-0000-000000000000.`,
    );
  }
}

function parseDate(
  value: string,
  fieldName: string,
): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(value);
  if (!match) {
    throw new ValidationError(
      `Invalid date for ${fieldName}: ${JSON.stringify(value)}. Expected format: YYYY-MM-DD.`,
    );
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  // Round-trip check guards against e.g. 2024-02-31.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    throw new ValidationError(
      `Invalid calendar date for ${fieldName}: ${JSON.stringify(value)}.`,
    );
  }
  return { y, m, d };
}

function parseModifiedAfter(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(
      `Invalid modifiedAfter timestamp: ${JSON.stringify(value)}. Expected ISO-8601 (e.g. 2024-01-01T00:00:00Z).`,
    );
  }
  return parsed;
}

function buildWhereClause(params: ListBankTransactionsParams): string | undefined {
  const groups: string[] = [];

  if (params.bankAccountId) {
    assertGuid(params.bankAccountId, "bankAccountId");
    groups.push(`BankAccount.AccountID==guid("${params.bankAccountId}")`);
  }

  if (params.bankTransactionIds?.length) {
    params.bankTransactionIds.forEach((id, i) =>
      assertGuid(id, `bankTransactionIds[${i}]`),
    );
    groups.push(
      params.bankTransactionIds
        .map((id) => `BankTransactionID==guid("${id}")`)
        .join(" OR "),
    );
  }

  if (params.contactIds?.length) {
    params.contactIds.forEach((id, i) => assertGuid(id, `contactIds[${i}]`));
    groups.push(
      params.contactIds
        .map((id) => `Contact.ContactID==guid("${id}")`)
        .join(" OR "),
    );
  }

  if (params.types?.length) {
    groups.push(params.types.map((t) => `Type=="${t}"`).join(" OR "));
  }

  if (params.statuses?.length) {
    groups.push(params.statuses.map((s) => `Status=="${s}"`).join(" OR "));
  }

  if (params.fromDate) {
    const { y, m, d } = parseDate(params.fromDate, "fromDate");
    groups.push(`Date>=DateTime(${y},${m},${d})`);
  }

  if (params.toDate) {
    const { y, m, d } = parseDate(params.toDate, "toDate");
    groups.push(`Date<=DateTime(${y},${m},${d})`);
  }

  if (params.where && params.where.trim().length > 0) {
    groups.push(params.where);
  }

  if (groups.length === 0) return undefined;
  return groups.map((g) => `(${g})`).join(" AND ");
}

async function getBankTransactions(
  params: ListBankTransactionsParams,
  whereClause: string | undefined,
  ifModifiedSince: Date | undefined,
): Promise<BankTransaction[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getBankTransactions(
    xeroClient.tenantId,
    ifModifiedSince,
    whereClause,
    params.order ?? "Date DESC",
    params.page ?? 1,
    undefined, // unitdp
    params.pageSize ?? 10,
    getClientHeaders(),
  );

  return response.body.bankTransactions ?? [];
}

export async function listXeroBankTransactions(
  params: ListBankTransactionsParams = {},
): Promise<XeroClientResponse<BankTransaction[]>> {
  try {
    const ifModifiedSince = params.modifiedAfter
      ? parseModifiedAfter(params.modifiedAfter)
      : undefined;
    const whereClause = buildWhereClause(params);

    const bankTransactions = await getBankTransactions(
      params,
      whereClause,
      ifModifiedSince,
    );

    return {
      result: bankTransactions,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error:
        error instanceof ValidationError ? error.message : formatError(error),
    };
  }
}
