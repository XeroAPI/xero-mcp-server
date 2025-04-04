import { z } from "zod";
import { createXeroInvoice } from "../../handlers/create-xero-invoice.handler.js";
import { ToolDefinition } from "../../types/tool-definition.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const toolName = "create-invoice";
const toolDescription =
  "Create an invoice in Xero.\
 When an invoice is created, a deep link to the invoice in Xero is returned. \
 This deep link can be used to view the invoice in Xero directly. \
 This link should be displayed to the user.";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const toolSchema = {
  contactId: z.string(),
  lineItems: z.array(lineItemSchema),
  reference: z.string().optional(),
};

const toolHandler = async (
  {
    contactId,
    lineItems,
    reference,
  }: {
    contactId: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode: string;
      taxType: string;
    }>;
    reference?: string;
  },
  //_extra: { signal: AbortSignal },
) => {
  const result = await createXeroInvoice(contactId, lineItems, reference);
  if (result.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating invoice: ${result.error}`,
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
          "Invoice created successfully:",
          `ID: ${invoice?.invoiceID}`,
          `Contact: ${invoice?.contact?.name}`,
          `Total: ${invoice?.total}`,
          `Status: ${invoice?.status}`,
          deepLink ? `Link to view: ${deepLink}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  };
};

export const CreateInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
