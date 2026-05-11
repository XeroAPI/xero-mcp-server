import { xeroClient } from "../clients/xero-client.js";
import { BankTransaction } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

const MAX_PAGE_SIZE = 100;

function toXeroDateTime(iso: string, label: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new Error(`${label} must be in YYYY-MM-DD format, got "${iso}"`);
  }
  const [, y, m, d] = match;
  return `DateTime(${Number(y)},${Number(m)},${Number(d)})`;
}

async function getBankTransactions(
  page: number,
  {
    bankAccountId,
    fromDate,
    toDate,
    isReconciled,
    pageSize,
  }: {
    bankAccountId?: string;
    fromDate?: string;
    toDate?: string;
    isReconciled?: boolean;
    pageSize?: number;
  },
): Promise<BankTransaction[]> {
  await xeroClient.authenticate();

  const whereConditions: string[] = [];
  if (bankAccountId) {
    whereConditions.push(`BankAccount.AccountID=guid("${bankAccountId}")`);
  }
  if (fromDate) {
    whereConditions.push(`Date >= ${toXeroDateTime(fromDate, "fromDate")}`);
  }
  if (toDate) {
    whereConditions.push(`Date <= ${toXeroDateTime(toDate, "toDate")}`);
  }
  if (isReconciled !== undefined) {
    whereConditions.push(`IsReconciled == ${isReconciled}`);
  }

  const where =
    whereConditions.length > 0 ? whereConditions.join(" AND ") : undefined;

  const resolvedPageSize = Math.min(pageSize ?? 10, MAX_PAGE_SIZE);

  const response = await xeroClient.accountingApi.getBankTransactions(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    where,
    "Date DESC", // order
    page,
    undefined, // unitdp
    resolvedPageSize,
    getClientHeaders(),
  );

  return response.body.bankTransactions ?? [];
}

export async function listXeroBankTransactions(
  page: number = 1,
  {
    bankAccountId,
    fromDate,
    toDate,
    isReconciled,
    pageSize,
  }: {
    bankAccountId?: string;
    fromDate?: string;
    toDate?: string;
    isReconciled?: boolean;
    pageSize?: number;
  } = {},
): Promise<XeroClientResponse<BankTransaction[]>> {
  try {
    const bankTransactions = await getBankTransactions(page, {
      bankAccountId,
      fromDate,
      toDate,
      isReconciled,
      pageSize,
    });

    return {
      result: bankTransactions,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
