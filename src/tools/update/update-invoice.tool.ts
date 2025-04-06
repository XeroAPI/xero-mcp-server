import { z } from "zod";
import { updateXeroInvoice } from "../../handlers/update-xero-invoice.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const UpdateInvoiceTool = CreateXeroTool(
  "update-invoice",
  "Update an invoice in Xero. Only works on draft invoices.\
  All line items must be provided. Any line items not provided will be removed. Including existing line items.\
  Do not modify line items that have not been specified by the user.\
 When an invoice is updated, a deep link to the invoice in Xero is returned. \
 This deep link can be used to view the contact in Xero directly. \
 This link should be displayed to the user.",
  {
    invoiceId: z.string(),
    lineItems: z.array(lineItemSchema).optional().describe(
      "All line items must be provided. Any line items not provided will be removed. Including existing line items. \
      Do not modify line items that have not been specified by the user",
    ),
    reference: z.string().optional(),
    dueDate: z.string().optional(),
  },
  async (
    {
      invoiceId,
      lineItems,
      reference,
      dueDate,
    }: {
      invoiceId: string;
      lineItems?: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
        accountCode: string;
        taxType: string;
      }>;
      reference?: string;
      dueDate?: string;
    },
    //_extra: { signal: AbortSignal },
  ) => {
    const result = await updateXeroInvoice(
      invoiceId,
      lineItems,
      reference,
      dueDate,
    );
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating invoice: ${result.error}`,
          },
        ],
      };
    }

    const invoice = result.result;

    const deepLink = invoice.invoiceID
      ? await getDeepLink(DeepLinkType.INVOICE, invoice.invoiceID)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Invoice updated successfully:",
            `ID: ${invoice?.invoiceID}`,
            `Contact: ${invoice?.contact?.name}`,
            `Total: ${invoice?.total}`,
            `Status: ${invoice?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ].join("\n"),
        },
      ],
    };
  },
);

export default UpdateInvoiceTool;
