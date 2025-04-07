import { z } from "zod";
import { updateXeroQuote } from "../../handlers/update-xero-quote.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const UpdateQuoteTool = CreateXeroTool(
  "update-quote",
  "Update a quote in Xero. Only works on draft quotes.\
  All line items must be provided. Any line items not provided will be removed. Including existing line items.\
  Do not modify line items that have not been specified by the user. \
 When a quote is updated, a deep link to the quote in Xero is returned. \
 This deep link can be used to view the quote in Xero directly. \
 This link should be displayed to the user.",
  {
    quoteId: z.string(),
    lineItems: z.array(lineItemSchema).optional().describe(
      "All line items must be provided. Any line items not provided will be removed. Including existing line items. \
      Do not modify line items that have not been specified by the user",
    ),
    reference: z.string().optional(),
    terms: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    quoteNumber: z.string().optional(),
    contactId: z.string().optional(),
    date: z.string().optional(),
    expiryDate: z.string().optional(),
  },
  async (
    {
      quoteId,
      lineItems,
      reference,
      terms,
      title,
      summary,
      quoteNumber,
      contactId,
      date,
      expiryDate,
    }
  ) => {
    const result = await updateXeroQuote(
      quoteId,
      lineItems,
      reference,
      terms,
      title,
      summary,
      quoteNumber,
      contactId,
      date,
      expiryDate,
    );
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating quote: ${result.error}`,
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
            "Quote updated successfully:",
            `ID: ${quote?.quoteID}`,
            `Contact: ${quote?.contact?.name}`,
            `Total: ${quote?.total}`,
            `Status: ${quote?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ].join("\n"),
        },
      ],
    };
  },
);

export default UpdateQuoteTool; 