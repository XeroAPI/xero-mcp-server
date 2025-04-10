import { Payment } from "xero-node";

export function paymentFormatter(payment: Payment): string {
  return [
    `Payment ID: ${payment.paymentID || "Unknown"}`,
    `Date: ${payment.date || "Unknown date"}`,
    `Amount: ${payment.amount || 0}`,
    payment.reference ? `Reference: ${payment.reference}` : null,
    payment.status ? `Status: ${payment.status}` : null,
    payment.paymentType ? `Payment Type: ${payment.paymentType}` : null,
    payment.updatedDateUTC ? `Last Updated: ${payment.updatedDateUTC}` : null,
    payment.account?.name
      ? `Account: ${payment.account.name} (${payment.account.accountID || "Unknown ID"})`
      : null,
    payment.invoice
      ? [
          `Invoice:`,
          `  Invoice Number: ${payment.invoice.invoiceNumber || "Unknown"}`,
          `  Invoice ID: ${payment.invoice.invoiceID || "Unknown"}`,
          payment.invoice.contact
            ? `  Contact: ${payment.invoice.contact.name || "Unknown"} (${payment.invoice.contact.contactID || "Unknown ID"})`
            : null,
          payment.invoice.type ? `  Type: ${payment.invoice.type}` : null,
          payment.invoice.total !== undefined
            ? `  Total: ${payment.invoice.total}`
            : null,
          payment.invoice.amountDue !== undefined
            ? `  Amount Due: ${payment.invoice.amountDue}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default paymentFormatter;
