import { z } from "zod";

import { getXeroQuote } from "../../handlers/get-xero-quote.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { formatQuote } from "../../helpers/format-quote.js";

const GetQuoteTool = CreateXeroTool(
  "get-quote",
  `Get a single quote from Xero by quote ID or quote number, including every line item.
Use this before creating an invoice from a quote. Pass each quote line to create-invoice as its own line item. Do not combine line items into one line.`,
  {
    quoteId: z
      .string()
      .optional()
      .describe("The quote ID. Can be obtained from list-quotes."),
    quoteNumber: z
      .string()
      .optional()
      .describe("The quote number, for example QU-0001. Used when quoteId is not provided."),
  },
  async ({ quoteId, quoteNumber }) => {
    const response = await getXeroQuote({ quoteId, quoteNumber });

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving quote: ${response.error}`,
          },
        ],
      };
    }

    const quote = response.result;

    const deepLink = quote.quoteID
      ? await getDeepLink(DeepLinkType.QUOTE, quote.quoteID)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [formatQuote(quote), deepLink ? `Link to view: ${deepLink}` : null]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default GetQuoteTool;
