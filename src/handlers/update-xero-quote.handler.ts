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

type QuoteStatus = "SENT" | "ACCEPTED" | "DECLINED" | "INVOICED" | "DELETED";

const validStatusTransitions: Partial<Record<QuoteStatusCodes, QuoteStatusCodes[]>> = {
  [QuoteStatusCodes.DRAFT]: [QuoteStatusCodes.SENT, QuoteStatusCodes.DELETED],
  [QuoteStatusCodes.SENT]: [
    QuoteStatusCodes.ACCEPTED,
    QuoteStatusCodes.DECLINED,
    QuoteStatusCodes.DELETED,
  ],
  [QuoteStatusCodes.DECLINED]: [QuoteStatusCodes.SENT, QuoteStatusCodes.DELETED],
  [QuoteStatusCodes.ACCEPTED]: [
    QuoteStatusCodes.INVOICED,
    QuoteStatusCodes.SENT,
    QuoteStatusCodes.DELETED,
  ],
  [QuoteStatusCodes.INVOICED]: [QuoteStatusCodes.SENT, QuoteStatusCodes.DELETED],
};

async function getQuote(quoteId: string): Promise<Quote | undefined> {
  await xeroClient.authenticate();

  // First, get the current quote to check its status
  const response = await xeroClient.accountingApi.getQuote(
    xeroClient.tenantId, // tenantId
    quoteId, // quoteId
    getClientHeaders(), // options
  );

  return response.body.quotes?.[0];
}

async function updateQuote(
  quoteId: string,
  lineItems?: QuoteLineItem[],
  reference?: string,
  terms?: string,
  title?: string,
  summary?: string,
  quoteNumber?: string,
  contactId?: string,
  date?: string,
  expiryDate?: string,
  status?: QuoteStatusCodes,
): Promise<Quote | undefined> {
  const quote: Quote = {};

  if (lineItems !== undefined) quote.lineItems = lineItems;
  if (reference !== undefined) quote.reference = reference;
  if (terms !== undefined) quote.terms = terms;
  if (title !== undefined) quote.title = title;
  if (summary !== undefined) quote.summary = summary;
  if (quoteNumber !== undefined) quote.quoteNumber = quoteNumber;
  if (expiryDate !== undefined) quote.expiryDate = expiryDate;
  if (status !== undefined) quote.status = status;

  if (contactId !== undefined) {
    quote.contact = { contactID: contactId };
  }

  if (date !== undefined) {
    quote.date = date;
  }

  const response = await xeroClient.accountingApi.updateQuote(
    xeroClient.tenantId,
    quoteId, // quoteId
    {
      quotes: [quote],
    }, // quotes
    undefined, // idempotencyKey
    getClientHeaders(), // options
  );

  return response.body.quotes?.[0];
}

/**
 * Update an existing quote in Xero
 */
export async function updateXeroQuote(
  quoteId: string,
  lineItems?: QuoteLineItem[],
  reference?: string,
  terms?: string,
  title?: string,
  summary?: string,
  quoteNumber?: string,
  contactId?: string,
  date?: string,
  expiryDate?: string,
  status?: QuoteStatus,
): Promise<XeroClientResponse<Quote>> {
  try {
    const existingQuote = await getQuote(quoteId);

    const quoteStatus = existingQuote?.status;
    const nextStatus = status ? QuoteStatusCodes[status] : undefined;
    const isEditable =
      quoteStatus === QuoteStatusCodes.DRAFT ||
      quoteStatus === QuoteStatusCodes.SENT;
    const isValidStatusTransition =
      quoteStatus !== undefined &&
      nextStatus !== undefined &&
      validStatusTransitions[quoteStatus]?.includes(nextStatus);
    const hasChangesOutsideStatus = [
      lineItems,
      reference,
      terms,
      title,
      summary,
      quoteNumber,
      contactId,
      date,
      expiryDate,
    ].some((value) => value !== undefined);

    if (nextStatus !== undefined ? !isValidStatusTransition : !isEditable) {
      return {
        result: null,
        isError: true,
        error: `Cannot update quote because it is neither editable nor eligible for the requested status transition. Current status: ${quoteStatus}`,
      };
    }

    if (!isEditable && hasChangesOutsideStatus) {
      return {
        result: null,
        isError: true,
        error: `Cannot update quote fields alongside a status transition. Current status: ${quoteStatus}`,
      };
    }

    const updatedQuote = await updateQuote(
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
      nextStatus,
    );

    if (!updatedQuote) {
      throw new Error("Quote update failed.");
    }

    return {
      result: updatedQuote,
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
