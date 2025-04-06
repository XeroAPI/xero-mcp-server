import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Quote, QuoteStatusCodes } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface QuoteLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
}

async function createQuote(
  quoteNumber: string | undefined,
  reference: string | undefined,
  terms: string | undefined,
  contactId: string,
  lineItems: QuoteLineItem[],
  title: string | undefined,
  summary: string | undefined,
): Promise<Quote | undefined> {
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

  const response = await xeroClient.accountingApi.createQuotes(
    xeroClient.tenantId,
    {
      quotes: [quote],
    }, // quotes
    true, //summarizeErrors
    undefined, //idempotencyKey
    getClientHeaders(),
  );
  const createdQuote = response.body.quotes?.[0];
  return createdQuote;
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
): Promise<XeroClientResponse<Quote>> {
  try {
    const createdQuote = await createQuote(
      quoteNumber,
      reference,
      terms,
      contactId,
      lineItems,
      title,
      summary,
    );

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
