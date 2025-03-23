import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Quote, QuoteStatusCodes, LineItem } from "xero-node";

interface QuoteLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
}

/**
 * Create a new quote in Xero
 */
export async function createXeroQuote(
  contactId: string,
  lineItems: QuoteLineItem[],
  reference?: string,
  quoteNumber?: string,
  terms?: string,
  title?: string,
  summary?: string,
): Promise<ToolResponse<Quote>> {
  try {
    await xeroClient.authenticate();

    const quote: Quote = {
      quoteNumber: quoteNumber,
      reference: reference,
      terms: terms,
      contact: {
        contactID: contactId,
      },
      date: new Date().toISOString().split("T")[0], // Today's date
      lineItems: lineItems,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 7 days from now
      status: QuoteStatusCodes.DRAFT,
      title: title,
      summary: summary,
    };

    const response = await xeroClient.accountingApi.createQuotes("", {
      quotes: [quote],
    });

    const createdQuote = response.body.quotes?.[0];

    if (!createdQuote) {
      throw new Error("Quote creation failed.");
    }

    return {
      result: createdQuote,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
