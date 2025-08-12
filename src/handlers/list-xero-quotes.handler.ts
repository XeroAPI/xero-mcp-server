import { createXeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Quote } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getQuotes(
  bearerToken: string,
  contactId: string | undefined,
  page: number,
  quoteNumber: string | undefined,
): Promise<Quote[]> {
  const xeroClient = createXeroClient(bearerToken);
  await xeroClient.authenticate();

  const quotes = await xeroClient.accountingApi.getQuotes(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    undefined, // dateFrom
    undefined, // dateTo
    undefined, // expiryDateFrom
    undefined, // expiryDateTo
    contactId, // contactID
    undefined, // status
    page,
    undefined, // order
    quoteNumber, // quoteNumber
    getClientHeaders(),
  );
  return quotes.body.quotes ?? [];
}

/**
 * List all quotes from Xero
 */
export async function listXeroQuotes(
  bearerToken: string,
  page: number = 1,
  contactId?: string,
  quoteNumber?: string,
): Promise<XeroClientResponse<Quote[]>> {
  try {
    const quotes = await getQuotes(bearerToken, contactId, page, quoteNumber);

    return {
      result: quotes,
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
