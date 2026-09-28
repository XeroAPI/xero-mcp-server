import { z } from "zod";
import { listXeroQuotes } from "../../handlers/list-xero-quotes.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatQuote } from "../../helpers/format-quote.js";

const ListQuotesTool = CreateXeroTool(
  "list-quotes",
  `List quotes in Xero, including each quote's line items.
Ask the user if they want quotes for a specific contact before running.
Ask the user if they want the next page after running this tool if 10 quotes are returned.
If they do, call this tool again with the next page number and the same contact or quote number.
When creating an invoice from a quote, pass each listed line item to create-invoice as its own line. Do not combine them into one line. Use get-quote for a single quote if you only have the ID.`,
  {
    page: z.number(),
    contactId: z.string().optional(),
    quoteNumber: z.string().optional(),
  },
  async ({ page, contactId, quoteNumber }) => {
    const response = await listXeroQuotes(page, contactId, quoteNumber);
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing quotes: ${response.error}`,
          },
        ],
      };
    }

    const quotes = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${quotes?.length || 0} quotes:`,
        },
        ...(quotes?.map((quote) => ({
          type: "text" as const,
          text: formatQuote(quote),
        })) || []),
      ],
    };
  },
);

export default ListQuotesTool;
