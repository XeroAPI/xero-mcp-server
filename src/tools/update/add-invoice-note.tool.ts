import { z } from "zod";
import { addXeroInvoiceNote } from "../../handlers/add-xero-invoice-note.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const AddInvoiceNoteTool = CreateXeroTool(
  "add-invoice-note",
  "Add a history note to an invoice in Xero. Use this to annotate an invoice with audit or bookkeeping context.",
  {
    invoiceId: z.string().describe("The ID of the invoice to annotate."),
    note: z.string().max(4000).describe("The history note to add to the invoice."),
  },
  async ({ invoiceId, note }) => {
    const response = await addXeroInvoiceNote(invoiceId, note);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error adding invoice note: ${response.error}`,
          },
        ],
      };
    }

    const deepLink = await getDeepLink(DeepLinkType.INVOICE, invoiceId);

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Invoice note added successfully:",
            `Invoice ID: ${invoiceId}`,
            `Note: ${response.result}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default AddInvoiceNoteTool;
