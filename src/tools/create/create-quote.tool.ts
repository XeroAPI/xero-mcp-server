import { z } from "zod";
import { createXeroQuote } from "../../handlers/create-xero-quote.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const trackingSchema = z.object({
  trackingCategoryID: z.string().optional(),
  trackingOptionID: z.string().min(1).describe(
    "Xero tracking option ID. Quotes require this ID rather than a tracking option name.",
  ),
});

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().optional(),
  unitAmount: z.number().optional(),
  itemCode: z.string().optional(),
  accountCode: z.string().optional(),
  taxType: z.string().optional(),
  tracking: z.array(trackingSchema).max(2).optional(),
  discountRate: z.number().optional(),
  discountAmount: z.number().optional(),
});

const CreateQuoteTool = CreateXeroTool(
  "create-quote",
  "Create a quote in Xero.\
 When a quote is created, a deep link to the quote in Xero is returned. \
 This deep link can be used to view the quote in Xero directly. \
 This link should be displayed to the user.",
  {
    contactId: z.string(),
    lineItems: z.array(lineItemSchema).min(1),
    reference: z.string().optional(),
    quoteNumber: z.string().optional(),
    terms: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
  },
  async ({
    contactId,
    lineItems,
    reference,
    quoteNumber,
    terms,
    title,
    summary,
  }) => {
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
  },
);

export default CreateQuoteTool;
