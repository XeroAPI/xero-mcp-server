import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroBankTransactions } from "../../handlers/list-xero-bank-transactions.handler.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const ListBankTransactionsTool = CreateXeroTool(
  "list-bank-transactions",
  `List bank transactions in Xero, with optional filters for bank account, date range, and reconciliation status.
  Use bankAccountId to scope to one account (find the account ID via list-accounts; bank-feed accounts have Type "BANK").
  Use fromDate and toDate (YYYY-MM-DD) to bound the period — these map to the transaction Date.
  Use isReconciled=false to surface items that have not been reconciled yet, or true to see only reconciled.
  pageSize defaults to 10 and is capped at 100; raise it for ops/finance questions over a date range.
  Results are ordered by Date DESC. If a full page is returned, more may exist — call again with page+1.`,
  {
    page: z.number().default(1),
    bankAccountId: z.string().optional(),
    fromDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .optional(),
    toDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .optional(),
    isReconciled: z.boolean().optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  },
  async ({ page, bankAccountId, fromDate, toDate, isReconciled, pageSize }) => {
    const response = await listXeroBankTransactions(page, {
      bankAccountId,
      fromDate,
      toDate,
      isReconciled,
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

    const bankTransactions = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${bankTransactions?.length || 0} bank transactions:`
        },
        ...(bankTransactions?.map((transaction) => ({
          type: "text" as const,
          text: [
            `Bank Transaction ID: ${transaction.bankTransactionID}`,
            `Bank Account: ${transaction.bankAccount.name} (${transaction.bankAccount.accountID})`,
            transaction.contact
              ? `Contact: ${transaction.contact.name} (${transaction.contact.contactID})`
              : null,
            transaction.reference ? `Reference: ${transaction.reference}` : null,
            transaction.date ? `Date: ${transaction.date}` : null,
            transaction.subTotal ? `Sub Total: ${transaction.subTotal}` : null,
            transaction.totalTax ? `Total Tax: ${transaction.totalTax}` : null,
            transaction.total ? `Total: ${transaction.total}` : null,
            transaction.isReconciled !== undefined ? (`${transaction.isReconciled ? "Reconciled" : "Unreconciled"}`) : null,
            transaction.currencyCode ? `Currency Code: ${transaction.currencyCode}` : null,
            `${transaction.status || "Unknown"}`,
            transaction.lineAmountTypes ? `Line Amount Types: ${transaction.lineAmountTypes}` : undefined,
            transaction.hasAttachments !== undefined
              ? (transaction.hasAttachments ? "Has attachments" : "Does not have attachments")
              : null,
            `Line Items:\n${transaction.lineItems?.map(formatLineItem).join("\n\n")}`,
          ].filter(Boolean).join("\n")
        })) || [])
      ]
    };
  }
);

export default ListBankTransactionsTool;
