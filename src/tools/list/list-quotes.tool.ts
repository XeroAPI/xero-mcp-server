import { z } from "zod";
import { listXeroQuotes } from "../../handlers/list-xero-quotes.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListQuotesTool = CreateXeroTool(
  "list-quotes",
  `List all quotes in Xero. 
  Ask the user if they want to see quotes for a specific contact before running. 
  Ask the user if they want the next page of quotes after running this tool if 10 quotes are returned. 
  If they do, call this tool again with the page number and the contact provided in the previous call.`,
  {
    page: z.number(),
    contactId: z.string().optional(),
  },
  async ({ page, contactId }: { page: number; contactId?: string }) => {
    const response = await listXeroQuotes(page, contactId);
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
          text: [
            `Quote Number: ${quote.quoteNumber || quote.quoteID}`,
            quote.reference ? `Reference: ${quote.reference}` : null,
            `Status: ${quote.status || "Unknown"}`,
            quote.contact
              ? `Contact: ${quote.contact.name} (${quote.contact.contactID})`
              : null,
            quote.dateString ? `Quote Date: ${quote.dateString}` : null,
            quote.expiryDateString
              ? `Expiry Date: ${quote.expiryDateString}`
              : null,
            quote.title ? `Title: ${quote.title}` : null,
            quote.summary ? `Summary: ${quote.summary}` : null,
            quote.terms ? `Terms: ${quote.terms}` : null,
            quote.lineAmountTypes
              ? `Line Amount Types: ${quote.lineAmountTypes}`
              : null,
            quote.subTotal ? `Sub Total: ${quote.subTotal}` : null,
            quote.totalTax ? `Total Tax: ${quote.totalTax}` : null,
            `Total: ${quote.total || 0}`,
            quote.totalDiscount
              ? `Total Discount: ${quote.totalDiscount}`
              : null,
            quote.currencyCode ? `Currency: ${quote.currencyCode}` : null,
            quote.currencyRate ? `Currency Rate: ${quote.currencyRate}` : null,
            quote.updatedDateUTC
              ? `Last Updated: ${quote.updatedDateUTC}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListQuotesTool;
