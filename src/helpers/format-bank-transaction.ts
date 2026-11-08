import { BankTransaction, LineItem } from "xero-node";
import { bankTransactionDeepLink } from "../consts/deeplinks.js";

const formatTracking = (lineItem: LineItem): string | null => {
  if (!lineItem.tracking?.length) return null;
  return `Tracking: ${lineItem.tracking
    .map((t) => `${t.name ?? t.trackingCategoryID}=${t.option ?? t.trackingOptionID}`)
    .join(", ")}`;
};

export const formatBankTransactionLineItem = (lineItem: LineItem, index: number): string =>
  [
    `  Line ${index + 1}:`,
    lineItem.lineItemID ? `    Line Item ID: ${lineItem.lineItemID}` : null,
    lineItem.itemCode ? `    Item Code: ${lineItem.itemCode}` : null,
    lineItem.description !== undefined ? `    Description: ${lineItem.description}` : null,
    lineItem.quantity !== undefined ? `    Quantity: ${lineItem.quantity}` : null,
    lineItem.unitAmount !== undefined ? `    Unit Amount: ${lineItem.unitAmount}` : null,
    lineItem.accountCode ? `    Account Code: ${lineItem.accountCode}` : null,
    lineItem.taxType ? `    Tax Type: ${lineItem.taxType}` : null,
    lineItem.taxAmount !== undefined ? `    Tax Amount: ${lineItem.taxAmount}` : null,
    lineItem.lineAmount !== undefined ? `    Line Amount: ${lineItem.lineAmount}` : null,
    formatTracking(lineItem) ? `    ${formatTracking(lineItem)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

export const formatBankTransaction = (
  transaction: BankTransaction,
  { includeLink = false }: { includeLink?: boolean } = {},
): string =>
  [
    `Bank Transaction ID: ${transaction.bankTransactionID}`,
    transaction.type ? `Type: ${transaction.type}` : null,
    transaction.bankAccount
      ? `Bank Account: ${transaction.bankAccount.name ?? transaction.bankAccount.code ?? ""} (${transaction.bankAccount.accountID})`
      : null,
    transaction.contact
      ? `Contact: ${transaction.contact.name} (${transaction.contact.contactID})`
      : null,
    transaction.date ? `Date: ${transaction.date}` : null,
    transaction.reference ? `Reference: ${transaction.reference}` : null,
    `Status: ${transaction.status || "Unknown"}`,
    transaction.isReconciled !== undefined
      ? `Reconciled: ${transaction.isReconciled ? "Yes" : "No"}`
      : null,
    transaction.lineAmountTypes ? `Line Amount Types: ${transaction.lineAmountTypes}` : null,
    transaction.subTotal !== undefined ? `Sub Total: ${transaction.subTotal}` : null,
    transaction.totalTax !== undefined ? `Total Tax: ${transaction.totalTax}` : null,
    transaction.total !== undefined ? `Total: ${transaction.total}` : null,
    transaction.currencyCode ? `Currency Code: ${transaction.currencyCode}` : null,
    transaction.prepaymentID ? `Prepayment ID: ${transaction.prepaymentID}` : null,
    transaction.overpaymentID ? `Overpayment ID: ${transaction.overpaymentID}` : null,
    transaction.hasAttachments !== undefined
      ? `Attachments: ${transaction.hasAttachments ? "Yes" : "No"}`
      : null,
    transaction.updatedDateUTC ? `Last Updated (UTC): ${transaction.updatedDateUTC}` : null,
    includeLink && transaction.bankAccount?.accountID && transaction.bankTransactionID
      ? `Xero Link: ${bankTransactionDeepLink(transaction.bankAccount.accountID, transaction.bankTransactionID)}`
      : null,
    transaction.lineItems?.length
      ? `Line Items (${transaction.lineItems.length}):\n${transaction.lineItems
          .map(formatBankTransactionLineItem)
          .join("\n")}`
      : "Line Items: none",
  ]
    .filter(Boolean)
    .join("\n");
