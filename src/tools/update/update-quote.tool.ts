import { z } from "zod";
import { updateXeroQuote } from "../../handlers/update-xero-quote.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import {
  quoteLineAmountTypeNames,
  toQuoteLineAmountTypes,
} from "../../helpers/to-quote-line-amount-types.js";
import {
  settableQuoteStatusNames,
  toQuoteStatus,
} from "../../helpers/to-quote-status.js";

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
});

const UpdateQuoteTool = CreateXeroTool(
  "update-quote",
  "Update a quote in Xero. Editing a quote's content only works on draft quotes.\
  All line items must be provided. Any line items not provided will be removed. Including existing line items.\
  Do not modify line items that have not been specified by the user. \
 Changing only the status works on a quote at any stage except one already invoiced or deleted, \
 so a sent quote can be marked ACCEPTED or DECLINED. A status-only update leaves the rest of the quote untouched. \
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
    lineAmountTypes: z
      .enum(quoteLineAmountTypeNames)
      .optional()
      .describe(
        "Optional line amount types (EXCLUSIVE, INCLUSIVE, NO_TAX). Leave unset \
to keep the value already on the quote.",
      ),
    status: z
      .enum(settableQuoteStatusNames)
      .optional()
      .describe(
        "Optional new status (DRAFT, SENT, DECLINED, ACCEPTED). Use it to move a \
quote through the pipeline, for example marking a sent quote ACCEPTED once the \
customer approves it or DECLINED once they do not. Leave unset to keep the \
current status. A quote cannot be set to INVOICED here — that happens when an \
invoice is created from it. Xero also restricts which transitions are legal: an \
ACCEPTED quote cannot move straight to DECLINED, it has to go back to SENT \
first.",
      ),
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
      lineAmountTypes,
      status,
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
      toQuoteLineAmountTypes(lineAmountTypes),
      toQuoteStatus(status),
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
