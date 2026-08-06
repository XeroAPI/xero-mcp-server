import { z } from "zod";
import { listXeroQuotes } from "../../handlers/list-xero-quotes.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { LineItem } from "xero-node";

const formatQuoteLineItem = (lineItem: LineItem, index: number): string => {
  const tracking = lineItem.tracking
    ?.map((entry) => {
      const category = entry.name ?? entry.trackingCategoryID;
      const option = entry.option ?? entry.trackingOptionID;
      return category && option ? `${category}=${option}` : null;
    })
    .filter((entry): entry is string => entry !== null);

  return [
    `Line ${index + 1}:`,
    lineItem.lineItemID ? `Line Item ID: ${lineItem.lineItemID}` : null,
    lineItem.item?.itemID ? `Item ID: ${lineItem.item.itemID}` : null,
    lineItem.itemCode ? `Item Code: ${lineItem.itemCode}` : null,
    lineItem.description ? `Description: ${lineItem.description}` : null,
    lineItem.quantity !== undefined ? `Quantity: ${lineItem.quantity}` : null,
    lineItem.unitAmount !== undefined ? `Unit Amount: ${lineItem.unitAmount}` : null,
    lineItem.accountCode ? `Account Code: ${lineItem.accountCode}` : null,
    lineItem.taxType ? `Tax Type: ${lineItem.taxType}` : null,
    lineItem.taxAmount !== undefined ? `Tax Amount: ${lineItem.taxAmount}` : null,
    lineItem.discountRate !== undefined ? `Discount Rate: ${lineItem.discountRate}` : null,
    lineItem.discountAmount !== undefined ? `Discount Amount: ${lineItem.discountAmount}` : null,
    tracking?.length ? `Tracking: ${tracking.join(", ")}` : null,
    lineItem.lineAmount !== undefined ? `Line Amount: ${lineItem.lineAmount}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

const ListQuotesTool = CreateXeroTool(
  "list-quotes",
  `List all quotes in Xero. 
  Ask the user if they want to see quotes for a specific contact before running. 
  Ask the user if they want the next page of quotes after running this tool if 10 quotes are returned. 
  If they do, call this tool again with the page number and the contact provided in the previous call.`,
  {
    page: z.number(),
    contactId: z.string().optional(),
    quoteNumber: z.string().optional().describe(
      "Optional quote number. Provide this to retrieve line item IDs and details needed for a safe quote update.",
    ),
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
          text: [
            `Quote ID: ${quote.quoteID}`,
            `Quote Number: ${quote.quoteNumber}`,
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
            quoteNumber
              ? [
                  "Line Items:",
                  quote.lineItems?.length
                    ? quote.lineItems.map(formatQuoteLineItem).join("\n\n")
                    : "No line items returned.",
                ].join("\n")
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
