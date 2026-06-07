import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroBankTransactions } from "../../handlers/list-xero-bank-transactions.handler.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const BANK_TRANSACTION_TYPES = [
  "RECEIVE",
  "RECEIVEOVERPAYMENT",
  "RECEIVEPREPAYMENT",
  "SPEND",
  "SPENDOVERPAYMENT",
  "SPENDPREPAYMENT",
  "RECEIVETRANSFER",
  "SPENDTRANSFER",
] as const;

const BANK_TRANSACTION_STATUSES = ["AUTHORISED", "DELETED", "VOIDED"] as const;

const ListBankTransactionsTool = CreateXeroTool(
  "list-bank-transactions",
  `List bank transactions in Xero with optional advanced filtering.
  Default behaviour (no args): page 1, ordered by Date DESC, page size 10.
  Prefer dedicated filter params (bankAccountId, contactIds, bankTransactionIds, types, statuses, fromDate, toDate)
  over the 'where' escape hatch. Use 'where' only when a predicate cannot be expressed with the dedicated params
  (e.g. amount thresholds: "Total>1000", reconciliation status: "IsReconciled==true").
  Dedicated filters and 'where' compose with AND.
  Examples:
    - { bankAccountId, fromDate: "2024-01-01", toDate: "2024-01-31" }
    - { contactIds: ["..."], types: ["SPEND"], statuses: ["AUTHORISED"] }
    - { where: "Total>1000 AND IsReconciled==false" }
  If 'pageSize' results are returned, ask the user whether to fetch the next page; if so, call again with the
  same filters and an incremented 'page'.`,
  {
    page: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("1-based page number. Defaults to 1."),
    pageSize: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe(
        "Results per page (max 100). Defaults to 10. Increase only when you specifically need more rows in one call.",
      ),
    bankAccountId: z
      .string()
      .optional()
      .describe("GUID of a single bank account to scope results to."),
    bankTransactionIds: z
      .array(z.string())
      .optional()
      .describe("Filter to specific bank transaction GUIDs (OR-matched)."),
    contactIds: z
      .array(z.string())
      .optional()
      .describe("Filter to transactions for any of these contact GUIDs (OR-matched)."),
    types: z
      .array(z.enum(BANK_TRANSACTION_TYPES))
      .optional()
      .describe("Filter by transaction type (OR-matched)."),
    statuses: z
      .array(z.enum(BANK_TRANSACTION_STATUSES))
      .optional()
      .describe("Filter by transaction status (OR-matched)."),
    fromDate: z
      .string()
      .optional()
      .describe("Inclusive lower bound on transaction Date, format YYYY-MM-DD."),
    toDate: z
      .string()
      .optional()
      .describe("Inclusive upper bound on transaction Date, format YYYY-MM-DD."),
    where: z
      .string()
      .optional()
      .describe(
        "Raw Xero where-clause for predicates the dedicated filters cannot express. Combined with dedicated filters via AND.",
      ),
    order: z
      .string()
      .optional()
      .describe(
        'Xero order clause, e.g. "Date DESC" or "UpdatedDateUTC ASC". Invalid fields will be rejected by Xero. Defaults to "Date DESC".',
      ),
    modifiedAfter: z
      .string()
      .optional()
      .describe(
        "ISO-8601 timestamp (e.g. 2024-01-01T00:00:00Z). Only return transactions modified strictly after this time.",
      ),
  },
  async (params) => {
    const response = await listXeroBankTransactions(params);
    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing bank transactions: ${response.error}`,
          },
        ],
      };
    }

    const bankTransactions = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${bankTransactions?.length || 0} bank transactions:`,
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
