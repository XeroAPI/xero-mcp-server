import { z } from "zod";
import { listXeroInvoices } from "../handlers/list-xero-invoices.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";

const toolName = "list-invoices";
const toolDescription =
  `List invoices in Xero. This includes Draft, Submitted, and Paid invoices. 
  Ask the user if they want to see invoices for a specific contact,
  invoice number, or to see all invoices before running. 
  Ask the user if they want the next page of invoices after running this tool 
  if 10 invoices are returned. 
  If they want the next page, call this tool again with the next page number 
  and the contact or invoice number if one was provided in the previous call.`;
const toolSchema = {
  page: z.number(),
  contactIds: z.array(z.string()).optional(),
  invoiceNumbers: z.array(z.string()).optional(),
};

const toolHandler = async ({
  page,
  contactIds,
  invoiceNumbers,
}: {
  page: number;
  contactIds?: string[];
  invoiceNumbers?: string[];
}): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> => {
  const response = await listXeroInvoices(page, contactIds, invoiceNumbers);
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
          invoice.hasErrors ? "Has Errors: Yes" : null,
          invoice.isDiscounted ? "Is Discounted: Yes" : null,
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
