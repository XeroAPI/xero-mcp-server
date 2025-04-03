import { z } from "zod";
import { createXeroQuote } from "../handlers/create-xero-quote.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { DeepLinkType, getDeepLink } from "../helpers/get-deeplink.js";

const toolName = "create-quote";
const toolDescription =
  "Create a quote in Xero.\
 When a quote is created, a deep link to the quote in Xero is returned. \
 This deep link can be used to view the quote in Xero directly. \
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
  quoteNumber: z.string().optional(),
  terms: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
};

const toolHandler = async (
  {
    contactId,
    lineItems,
    reference,
    quoteNumber,
    terms,
    title,
    summary,
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
    quoteNumber?: string;
    terms?: string;
    title?: string;
    summary?: string;
  },
  //_extra: { signal: AbortSignal },
) => {
  const result = await createXeroQuote(
    contactId,
    lineItems,
    reference,
    quoteNumber,
    terms,
    title,
    summary,
  );
  if (result.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating quote: ${result.error}`,
        },
      ],
    };
  }

  const quote = result.result;

  const deepLink = quote.quoteID
    ? await getDeepLink(DeepLinkType.QUOTE, quote.quoteID)
    : null;

  return {
    content: [
      {
        type: "text" as const,
        text: [
          "Quote created successfully:",
          `ID: ${quote?.quoteID}`,
          `Contact: ${quote?.contact?.name}`,
          `Total: ${quote?.total}`,
          `Status: ${quote?.status}`,
          deepLink ? `Link to view: ${deepLink}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  };
};

export const CreateQuoteTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
