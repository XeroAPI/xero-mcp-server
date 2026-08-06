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
  date?: string,
  expiryDate?: string,
): Promise<Quote | undefined> {
  await xeroClient.authenticate();

  const quote: Quote = {
    quoteNumber: quoteNumber,
    reference: reference,
    terms: terms,
    contact: {
      contactID: contactId,
    },
    lineItems: lineItems,
    ...(date ? { date } : {}),
    ...(expiryDate ? { expiryDate } : {}),
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
  date?: string,
  expiryDate?: string,
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
      date,
      expiryDate,
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
