import { z } from "zod";
import { createXeroQuote } from "../../handlers/create-xero-quote.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import {
  quoteLineAmountTypeNames,
  toQuoteLineAmountTypes,
} from "../../helpers/to-quote-line-amount-types.js";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const CreateQuoteTool = CreateXeroTool(
  "create-quote",
  "Create a quote in Xero.\
 When a quote is created, a deep link to the quote in Xero is returned. \
 This deep link can be used to view the quote in Xero directly. \
 This link should be displayed to the user.",
  {
    contactId: z.string(),
    lineItems: z.array(lineItemSchema),
    reference: z.string().optional(),
    quoteNumber: z.string().optional(),
    terms: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    date: z
      .string()
      .optional()
      .describe("Optional quote date (YYYY-MM-DD). Defaults to today."),
    expiryDate: z
      .string()
      .optional()
      .describe(
        "Optional expiry date (YYYY-MM-DD). Defaults to seven days from the \
quote date. Set it explicitly where the quote has to clear a funder or a \
committee, because seven days will lapse long before they decide.",
      ),
    lineAmountTypes: z
      .enum(quoteLineAmountTypeNames)
      .optional()
      .describe(
        "Optional line amount types (EXCLUSIVE, INCLUSIVE, NO_TAX). Xero treats \
unit amounts as tax exclusive when this is omitted, so pass INCLUSIVE when the \
amounts supplied already include tax.",
      ),
  },
  async ({
    contactId,
    lineItems,
    reference,
    quoteNumber,
    terms,
    title,
    summary,
    lineAmountTypes,
    date,
    expiryDate,
  }) => {
    const result = await createXeroQuote(
      contactId,
      lineItems,
      reference,
      quoteNumber,
      terms,
      title,
      summary,
      toQuoteLineAmountTypes(lineAmountTypes),
      date,
      expiryDate,
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
