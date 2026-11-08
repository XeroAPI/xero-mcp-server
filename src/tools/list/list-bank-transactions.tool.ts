import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import {
  BANK_TRANSACTION_ORDERS,
  DEFAULT_BANK_TRANSACTIONS_PAGE_SIZE,
  listXeroBankTransactions,
} from "../../handlers/list-xero-bank-transactions.handler.js";
import { formatBankTransaction } from "../../helpers/format-bank-transaction.js";

// A fresh schema per field: a shared instance becomes a JSON Schema $ref,
// which some MCP clients don't resolve.
const isoDate = () => z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const ListBankTransactionsTool = CreateXeroTool(
  "list-bank-transactions",
  `List bank transactions in Xero (spend and receive money; not invoice payments).
  Optionally filter by bank account and by date range, and choose the sort order.
  Use fromDate/toDate to pull a period such as a quarter, e.g. fromDate 2026-07-01, toDate 2026-09-30.
  Both dates are inclusive. Results are paged; if a full page is returned, there may be more,
  so call again with the next page number and the same filters.
  Ask the user if they want to see bank transactions for a specific bank account,
  or for all accounts, before running.`,
  {
    page: z.number().int().min(1).describe("Page number, starting at 1."),
    bankAccountId: z
      .string()
      .optional()
      .describe("Xero AccountID (GUID) of the bank account. Omit for all bank accounts."),
    fromDate: isoDate()
      .optional()
      .describe("Only transactions dated on or after this date (YYYY-MM-DD, inclusive)."),
    toDate: isoDate()
      .optional()
      .describe("Only transactions dated on or before this date (YYYY-MM-DD, inclusive)."),
    order: z
      .enum(BANK_TRANSACTION_ORDERS)
      .optional()
      .describe("Sort order. Defaults to Date DESC (newest first)."),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe(`Transactions per page, 1-100. Defaults to ${DEFAULT_BANK_TRANSACTIONS_PAGE_SIZE}.`),
  },
  async ({ bankAccountId, page, fromDate, toDate, order, pageSize }) => {
    const response = await listXeroBankTransactions(page, bankAccountId, {
      fromDate,
      toDate,
      order,
      pageSize,
    });
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing bank transactions: ${response.error}`
          }
        ]
      };
    }

    const bankTransactions = response.result ?? [];
    const effectivePageSize = pageSize ?? DEFAULT_BANK_TRANSACTIONS_PAGE_SIZE;
    const filters = [
      bankAccountId ? `bank account ${bankAccountId}` : null,
      fromDate ? `from ${fromDate}` : null,
      toDate ? `to ${toDate}` : null,
    ].filter(Boolean).join(", ");

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Found ${bankTransactions.length} bank transactions on page ${page}` +
              (filters ? ` (${filters})` : "") +
              `, sorted by ${order ?? "Date DESC"}.`,
            bankTransactions.length === effectivePageSize
              ? `This page is full; there may be more on page ${page + 1}.`
              : null,
          ].filter(Boolean).join("\n")
        },
        ...bankTransactions.map((transaction) => ({
          type: "text" as const,
          text: formatBankTransaction(transaction),
        }))
      ]
    };
  }
);

export default ListBankTransactionsTool;
