import { Quote } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface GetXeroQuoteParams {
  quoteId?: string;
  quoteNumber?: string;
}

async function fetchQuoteById(quoteId: string): Promise<Quote | undefined> {
  const response = await xeroClient.accountingApi.getQuote(
    xeroClient.tenantId,
    quoteId,
    getClientHeaders(),
  );

  return response.body.quotes?.[0];
}

async function fetchQuoteByNumber(
  quoteNumber: string,
): Promise<Quote | undefined> {
  const response = await xeroClient.accountingApi.getQuotes(
    xeroClient.tenantId,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    1,
    undefined,
    quoteNumber,
    getClientHeaders(),
  );

  // Match the number exactly in case the filter returns similar numbers.
  return response.body.quotes?.find(
    (quote) => quote.quoteNumber === quoteNumber,
  );
}

/**
 * Get a single quote from Xero, including line items.
 */
export async function getXeroQuote(
  params: GetXeroQuoteParams,
): Promise<XeroClientResponse<Quote>> {
  try {
    if (!params.quoteId && !params.quoteNumber) {
      throw new Error("Provide a quoteId or quoteNumber.");
    }

    await xeroClient.authenticate();

    const quote = params.quoteId
      ? await fetchQuoteById(params.quoteId)
      : await fetchQuoteByNumber(params.quoteNumber as string);

    if (!quote) {
      throw new Error("Quote not found.");
    }

    return {
      result: quote,
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
