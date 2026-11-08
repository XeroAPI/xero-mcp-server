import { xeroClient } from "../clients/xero-client.js";
import { BankTransaction } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { buildBankTransactionsWhere } from "../helpers/build-bank-transactions-where.js";

export const BANK_TRANSACTION_ORDERS = [
  "Date DESC",
  "Date ASC",
  "Total DESC",
  "Total ASC",
  "UpdatedDateUTC DESC",
  "UpdatedDateUTC ASC",
] as const;

export type BankTransactionOrder = (typeof BANK_TRANSACTION_ORDERS)[number];

export interface ListBankTransactionsOptions {
  /** Inclusive start date, YYYY-MM-DD */
  fromDate?: string;
  /** Inclusive end date, YYYY-MM-DD */
  toDate?: string;
  order?: BankTransactionOrder;
  pageSize?: number;
}

export const DEFAULT_BANK_TRANSACTIONS_PAGE_SIZE = 10;

async function getBankTransactions(
  page: number,
  bankAccountId: string | undefined,
  options: ListBankTransactionsOptions,
): Promise<BankTransaction[]> {
  const where = buildBankTransactionsWhere({
    bankAccountId,
    fromDate: options.fromDate,
    toDate: options.toDate,
  });

  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getBankTransactions(xeroClient.tenantId,
      undefined, // ifModifiedSince
      where, // where
      options.order ?? "Date DESC", // order
      page, // page
      undefined, // unitdp
      options.pageSize ?? DEFAULT_BANK_TRANSACTIONS_PAGE_SIZE, // pagesize
      undefined, // references
      getClientHeaders()
  );

  return response.body.bankTransactions ?? [];
}

export async function listXeroBankTransactions(
  page: number = 1,
  bankAccountId?: string,
  options: ListBankTransactionsOptions = {},
): Promise<XeroClientResponse<BankTransaction[]>> {
  try {
    const bankTransactions = await getBankTransactions(page, bankAccountId, options);

    return {
      result: bankTransactions,
      isError: false,
      error: null
    }
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error)
    }
  }
}
