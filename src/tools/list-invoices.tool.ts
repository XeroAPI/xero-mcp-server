import { z } from "zod";
import { listXeroInvoices } from "../handlers/list-xero-invoices.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";

const toolName = "list-invoices";
const toolDescription =
  "List all invoices in Xero. This includes Draft, Submitted, and Paid invoices. Ask the user if they want the next page of invoices after running this tool. If they do, call this tool again with the page number.";
const toolSchema = {
  page: z.number(),
};

const toolHandler = async ({
  page,
}: {
  page: number;
}): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> => {
  const response = await listXeroInvoices(page);
  if (response.error !== null) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error listing invoices: ${response.error}`,
        },
      ],
    };
  }

  const invoices = response.result.invoices;

  return {
    content: [
      {
        type: "text" as const,
        text: `Found ${invoices?.length || 0} invoices:`,
      },
      ...(invoices?.map((invoice) => ({
        type: "text" as const,
        text: [
          `Invoice: ${invoice.invoiceNumber || invoice.invoiceID}`,
          invoice.reference ? `Reference: ${invoice.reference}` : null,
          `Type: ${invoice.type || "Unknown"}`,
          `Status: ${invoice.status || "Unknown"}`,
          invoice.contact
            ? `Contact: ${invoice.contact.name} (${invoice.contact.contactID})`
            : null,
          invoice.date ? `Date: ${invoice.date}` : null,
          invoice.dueDate ? `Due Date: ${invoice.dueDate}` : null,
          invoice.lineAmountTypes
            ? `Line Amount Types: ${invoice.lineAmountTypes}`
            : null,
          invoice.lineItems?.length ? "Line Items:" : null,
          ...(invoice.lineItems?.map(
            (item) =>
              `  - ${item.description || "No description"}
      Quantity: ${item.quantity || 0}
      Unit Amount: ${item.unitAmount || 0}
      Line Amount: ${item.lineAmount || 0}${
        item.taxType
          ? `
      Tax Type: ${item.taxType}`
          : ""
      }${
        item.taxAmount
          ? `
      Tax Amount: ${item.taxAmount}`
          : ""
      }${
        item.accountCode
          ? `
      Account Code: ${item.accountCode}`
          : ""
      }${
        item.discountRate
          ? `
      Discount Rate: ${item.discountRate}`
          : ""
      }${
        item.tracking?.length
          ? `
      Tracking: ${item.tracking.map((t) => `${t.name}: ${t.option}`).join(", ")}`
          : ""
      }`,
          ) || []),
          invoice.subTotal ? `Sub Total: ${invoice.subTotal}` : null,
          invoice.totalTax ? `Total Tax: ${invoice.totalTax}` : null,
          `Total: ${invoice.total || 0}`,
          invoice.totalDiscount
            ? `Total Discount: ${invoice.totalDiscount}`
            : null,
          invoice.currencyCode ? `Currency: ${invoice.currencyCode}` : null,
          invoice.currencyRate
            ? `Currency Rate: ${invoice.currencyRate}`
            : null,
          invoice.updatedDateUTC
            ? `Last Updated: ${invoice.updatedDateUTC}`
            : null,
          invoice.fullyPaidOnDate
            ? `Fully Paid On: ${invoice.fullyPaidOnDate}`
            : null,
          invoice.amountDue ? `Amount Due: ${invoice.amountDue}` : null,
          invoice.amountPaid ? `Amount Paid: ${invoice.amountPaid}` : null,
          invoice.amountCredited
            ? `Amount Credited: ${invoice.amountCredited}`
            : null,
          invoice.hasAttachments ? "Has Attachments: Yes" : null,
          invoice.hasErrors ? "Has Errors: Yes" : null,
          invoice.isDiscounted ? "Is Discounted: Yes" : null,
          invoice.payments?.length ? "Payments:" : null,
          ...(invoice.payments?.map(
            (payment) =>
              `  - ID: ${payment.paymentID}
      Date: ${payment.date || "Unknown"}
      Amount: ${payment.amount || 0}${
        payment.reference
          ? `
      Reference: ${payment.reference}`
          : ""
      }${
        payment.hasAccount
          ? `
      Has Account: Yes`
          : ""
      }${
        payment.hasValidationErrors
          ? `
      Has Validation Errors: Yes`
          : ""
      }`,
          ) || []),
          invoice.prepayments?.length ? "Prepayments:" : null,
          ...(invoice.prepayments?.map(
            (prepayment) =>
              `  - ID: ${prepayment.prepaymentID}
      Date: ${prepayment.date || "Unknown"}${
        prepayment.reference
          ? `
      Reference: ${prepayment.reference}`
          : ""
      }`,
          ) || []),
          invoice.overpayments?.length ? "Overpayments:" : null,
          ...(invoice.overpayments?.map(
            (overpayment) =>
              `  - ID: ${overpayment.overpaymentID}
      Date: ${overpayment.date || "Unknown"}`,
          ) || []),
          invoice.creditNotes?.length ? "Credit Notes:" : null,
          ...(invoice.creditNotes?.map(
            (note) =>
              `  - ID: ${note.creditNoteID}
      Number: ${note.creditNoteNumber || "Unknown"}${
        note.reference
          ? `
      Reference: ${note.reference}`
          : ""
      }
      Type: ${note.type || "Unknown"}
      Status: ${note.status || "Unknown"}
      Sub Total: ${note.subTotal || 0}
      Total Tax: ${note.totalTax || 0}
      Total: ${note.total || 0}
      Last Updated: ${note.updatedDateUTC || "Unknown"}`,
          ) || []),
        ]
          .filter(Boolean)
          .join("\n"),
      })) || []),
    ],
  };
};

export const ListInvoicesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
