import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Quote, QuoteLineAmountTypes, QuoteStatusCodes } from "xero-node";
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
  lineAmountTypes: QuoteLineAmountTypes | undefined,
  date: string | undefined,
  expiryDate: string | undefined,
): Promise<Quote | undefined> {
  await xeroClient.authenticate();

  const quote: Quote = {
    quoteNumber: quoteNumber,
    reference: reference,
    terms: terms,
    contact: {
      contactID: contactId,
    },
    date: date ?? new Date().toISOString().split("T")[0], // defaults to today
    lineItems: lineItems,
    // Defaults to seven days, which is what this tool has always used. Seven
    // days suits a quote a customer can accept on the spot, but is far too
    // short where the quote has to clear a funding body, so callers in that
    // position need to be able to set it.
    expiryDate:
      expiryDate ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    status: QuoteStatusCodes.DRAFT,
    title: title,
    summary: summary,
    // Xero treats line amounts as tax exclusive when this is omitted, so an
    // unspecified value keeps the previous behaviour.
    lineAmountTypes: lineAmountTypes,
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
  lineAmountTypes?: QuoteLineAmountTypes,
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
      lineAmountTypes,
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
