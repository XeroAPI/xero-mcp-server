import { Invoice } from "xero-node";
import { z } from "zod";
import { updateXeroInvoiceFields } from "../../handlers/update-xero-invoice-fields.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const UpdateInvoiceFieldsTool = CreateXeroTool(
  "update-invoice-fields",
  "Update specific top-level invoice or bill fields in Xero without sending line items. Use this for targeted changes such as dueDate, reference, date, contactId, expectedPaymentDate, or plannedPaymentDate. This is the preferred tool when only a due date or another single field needs to change. Xero still enforces which fields can be changed for the invoice's current status.",
  {
    invoiceId: z.string().describe("The ID of the invoice or bill to update."),
    dueDate: z
      .string()
      .optional()
      .describe("Optional new due date in YYYY-MM-DD format."),
    date: z
      .string()
      .optional()
      .describe("Optional new invoice date in YYYY-MM-DD format."),
    reference: z
      .string()
      .optional()
      .describe("Optional new invoice reference."),
    contactId: z
      .string()
      .optional()
      .describe("Optional replacement contact ID."),
    expectedPaymentDate: z
      .string()
      .optional()
      .describe("Optional expected payment date for sales invoices in YYYY-MM-DD format."),
    plannedPaymentDate: z
      .string()
      .optional()
      .describe("Optional planned payment date for bills in YYYY-MM-DD format."),
  },
  async ({
    invoiceId,
    dueDate,
    date,
    reference,
    contactId,
    expectedPaymentDate,
    plannedPaymentDate,
  }: {
    invoiceId: string;
    dueDate?: string;
    date?: string;
    reference?: string;
    contactId?: string;
    expectedPaymentDate?: string;
    plannedPaymentDate?: string;
  }) => {
    const result = await updateXeroInvoiceFields({
      invoiceId,
      dueDate,
      date,
      reference,
      contactId,
      expectedPaymentDate,
      plannedPaymentDate,
    });

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating invoice fields: ${result.error}`,
          },
        ],
      };
    }

    const invoice = result.result;
    const deepLink = invoice.invoiceID
      ? await getDeepLink(
          invoice.type === Invoice.TypeEnum.ACCREC ? DeepLinkType.INVOICE : DeepLinkType.BILL,
          invoice.invoiceID,
        )
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Invoice fields updated successfully:",
            `ID: ${invoice.invoiceID}`,
            invoice.invoiceNumber ? `Number: ${invoice.invoiceNumber}` : null,
            `Type: ${invoice.type}`,
            `Status: ${invoice.status}`,
            invoice.date ? `Date: ${invoice.date}` : null,
            invoice.dueDate ? `Due Date: ${invoice.dueDate}` : null,
            invoice.reference ? `Reference: ${invoice.reference}` : null,
            invoice.expectedPaymentDate
              ? `Expected Payment Date: ${invoice.expectedPaymentDate}`
              : null,
            invoice.plannedPaymentDate
              ? `Planned Payment Date: ${invoice.plannedPaymentDate}`
              : null,
            invoice.contact
              ? `Contact: ${invoice.contact.name || "Unknown"} (${invoice.contact.contactID || "Unknown ID"})`
              : null,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdateInvoiceFieldsTool;
