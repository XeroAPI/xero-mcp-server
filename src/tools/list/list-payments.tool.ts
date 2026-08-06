import { z } from "zod";
import { listXeroPayments } from "../../handlers/list-xero-payments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { Payment } from "xero-node";

function paymentFormatter(payment: Payment): string {
  return [
    `Payment ID: ${payment.paymentID || "Unknown"}`,
    `Date: ${payment.date || "Unknown date"}`,
    `Amount: ${payment.amount || 0}`,
    payment.reference ? `Reference: ${payment.reference}` : null,
    payment.status ? `Status: ${payment.status}` : null,
    payment.paymentType ? `Payment Type: ${payment.paymentType}` : null,
    payment.updatedDateUTC ? `Last Updated: ${payment.updatedDateUTC}` : null,
    payment.account && (payment.account.name || payment.account.code || payment.account.accountID)
      ? `Account: ${[
          payment.account.name,
          payment.account.code,
          payment.account.accountID,
        ].filter(Boolean).join(" | ")}`
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
    payment.creditNote
      ? [
          "Credit Note:",
          `  Credit Note Number: ${payment.creditNote.creditNoteNumber || payment.creditNoteNumber || "Unknown"}`,
          `  Credit Note ID: ${payment.creditNote.creditNoteID || "Unknown"}`,
          payment.creditNote.type ? `  Type: ${payment.creditNote.type}` : null,
          payment.creditNote.total !== undefined
            ? `  Total: ${payment.creditNote.total}`
            : null,
          payment.creditNote.remainingCredit !== undefined
            ? `  Remaining Credit: ${payment.creditNote.remainingCredit}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null,
    payment.prepayment
      ? [
          "Prepayment:",
          `  Prepayment ID: ${payment.prepayment.prepaymentID || "Unknown"}`,
          payment.invoiceNumber ? `  Invoice Number: ${payment.invoiceNumber}` : null,
          payment.prepayment.reference ? `  Reference: ${payment.prepayment.reference}` : null,
          payment.prepayment.type ? `  Type: ${payment.prepayment.type}` : null,
          payment.prepayment.remainingCredit !== undefined
            ? `  Remaining Credit: ${payment.prepayment.remainingCredit}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null,
    payment.overpayment
      ? [
          "Overpayment:",
          `  Overpayment ID: ${payment.overpayment.overpaymentID || "Unknown"}`,
          payment.invoiceNumber ? `  Invoice Number: ${payment.invoiceNumber}` : null,
          payment.overpayment.type ? `  Type: ${payment.overpayment.type}` : null,
          payment.overpayment.remainingCredit !== undefined
            ? `  Remaining Credit: ${payment.overpayment.remainingCredit}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const ListPaymentsTool = CreateXeroTool(
  "list-payments",
  `List payments in Xero. 
  This tool shows payments and refunds against invoices, credit notes, prepayments, and overpayments, including payment date, amount, and payment method.
  You can filter payments by invoice number, invoice ID, payment ID, or invoice reference.
  Ask the user if they want to see payments for a specific invoice, contact, payment or reference before running.
  If many payments are returned, ask the user if they want to see the next page.`,
  {
    page: z.number().default(1),
    invoiceNumber: z.string().optional(),
    invoiceId: z.string().uuid().optional(),
    paymentId: z.string().uuid().optional(),
    reference: z.string().optional(),
  },
  async ({ page, invoiceNumber, invoiceId, paymentId, reference }) => {
    const response = await listXeroPayments(page, {
      invoiceNumber,
      invoiceId,
      paymentId,
      reference,
    });

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing payments: ${response.error}`,
          },
        ],
      };
    }

    const payments = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${payments?.length || 0} payments:`,
        },
        ...(payments?.map((payment) => ({
          type: "text" as const,
          text: paymentFormatter(payment),
        })) || []),
      ],
    };
  },
);

export default ListPaymentsTool;
