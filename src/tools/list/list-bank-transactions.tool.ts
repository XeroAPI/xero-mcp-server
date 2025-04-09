import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroBankTransactions } from "../../handlers/list-xero-bank-transactions.handler.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const ListBankTransactionsTool = CreateXeroTool(
  "list-bank-transactions",
  `List all bank transactions in Xero.
  Ask the user if they want to see bank transactions for a specific bank account,
  or to see all bank transactions before running.
  Ask the user if they want the next page of quotes after running this tool if
  10 bank transactions are returned.
  If they do, call this tool again with the next page number and the bank account
  if one was provided in the provided in the previous call.`,
  {
    page: z.number(),
    bankAccountId: z.string().optional()
  },
  async ({ bankAccountId, page }) => {
    const response = await listXeroBankTransactions(page, bankAccountId);
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
            `Line Items: ${transaction.lineItems?.map(formatLineItem)}`,
          ].filter(Boolean).join("\n")
        })) || [])
      ]
    };
  }
);

export default ListBankTransactionsTool;