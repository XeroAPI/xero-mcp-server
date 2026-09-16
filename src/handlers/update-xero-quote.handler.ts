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
  lineAmountTypes?: QuoteLineAmountTypes,
  status?: QuoteStatusCodes,
  existingQuote?: Quote,
): Promise<Quote | undefined> {
  const statusOnly = isStatusOnlyUpdate({
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
  });

  // A status-only update sends the status and nothing else.
  //
  // It is tempting to read the quote and send its existing fields back, but
  // that silently re-prices a tax-inclusive quote. Xero returns a quote's
  // line items with unit amounts already reduced to their tax-exclusive
  // values; POSTing those back alongside lineAmountTypes INCLUSIVE makes Xero
  // strip the tax a second time, so a $992.73 quote becomes $902.48 on a
  // change of status alone. Sending only the status leaves every monetary
  // field untouched by definition.
  if (statusOnly) {
    // A status-only update must change the status and nothing else, which
    // needs care in both directions.
    //
    // Omitting a field clears it: Xero drops the reference, terms, title,
    // summary and expiry date, and resets lineAmountTypes to EXCLUSIVE. So
    // every one of those is echoed back unchanged.
    //
    // Line items are the exception, and must NOT be sent. Xero returns them
    // with unit amounts already reduced to their tax-exclusive values, so
    // POSTing them back alongside lineAmountTypes INCLUSIVE makes Xero strip
    // the tax a second time and a $992.73 quote becomes $902.48. Left out of
    // the request they are preserved untouched, which is both correct and
    // cheaper.
    const response = await xeroClient.accountingApi.updateQuote(
      xeroClient.tenantId,
      quoteId,
      {
        quotes: [
          {
            quoteID: quoteId,
            status,
            ...(existingQuote?.contact ? { contact: existingQuote.contact } : {}),
            ...(existingQuote?.date ? { date: existingQuote.date } : {}),
            ...(existingQuote?.expiryDate
              ? { expiryDate: existingQuote.expiryDate }
              : {}),
            ...(existingQuote?.quoteNumber
              ? { quoteNumber: existingQuote.quoteNumber }
              : {}),
            ...(existingQuote?.reference
              ? { reference: existingQuote.reference }
              : {}),
            ...(existingQuote?.terms ? { terms: existingQuote.terms } : {}),
            ...(existingQuote?.title ? { title: existingQuote.title } : {}),
            ...(existingQuote?.summary
              ? { summary: existingQuote.summary }
              : {}),
            ...(existingQuote?.lineAmountTypes
              ? { lineAmountTypes: existingQuote.lineAmountTypes }
              : {}),
          },
        ],
      },
      undefined, // idempotencyKey
      getClientHeaders(),
    );

    return response.body.quotes?.[0];
  }

  const quote: Quote = {
    lineItems: lineItems,
    reference: reference,
    terms: terms,
    title: title,
    summary: summary,
    quoteNumber: quoteNumber,
    expiryDate: expiryDate,
    // Carry the existing value forward when unspecified. Without this an update
    // that omits it silently re-prices an inclusive quote as tax exclusive.
    lineAmountTypes: lineAmountTypes ?? existingQuote?.lineAmountTypes,
  };

  // A content update may also move the status.
  if (status) {
    quote.status = status;
  }

  // Only add contact if contactId is provided, otherwise use existing
  if (contactId) {
    quote.contact = { contactID: contactId };
  } else if (existingQuote?.contact) {
    quote.contact = existingQuote.contact;
  }

  // Only add date if provided, otherwise use existing
  if (date) {
    quote.date = date;
  } else if (existingQuote?.date) {
    quote.date = existingQuote.date;
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

function isStatusOnlyUpdate(fields: Record<string, unknown>): boolean {
  return Object.values(fields).every((value) => value === undefined);
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
  lineAmountTypes?: QuoteLineAmountTypes,
  status?: QuoteStatusCodes,
): Promise<XeroClientResponse<Quote>> {
  try {
    const existingQuote = await getQuote(quoteId);

    const quoteStatus = existingQuote?.status;

    const statusOnly = isStatusOnlyUpdate({
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
    });

    // A quote's content is only editable while it is a draft. Its status,
    // however, is what moves it through the pipeline — marking a sent quote
    // accepted or declined has to work on a quote that is no longer a draft,
    // so a status-only update is allowed on any quote Xero still lets us
    // update.
    if (!statusOnly && quoteStatus !== QuoteStatusCodes.DRAFT) {
      return {
        result: null,
        isError: true,
        error: `Cannot update quote because it is not a draft. Current status: ${quoteStatus}`,
      };
    }

    if (
      statusOnly &&
      (quoteStatus === QuoteStatusCodes.INVOICED ||
        quoteStatus === QuoteStatusCodes.DELETED)
    ) {
      return {
        result: null,
        isError: true,
        error: `Cannot change the status of a quote that is ${quoteStatus}.`,
      };
    }

    if (statusOnly && !status) {
      return {
        result: null,
        isError: true,
        error: "Nothing to update. Provide a status or at least one field to change.",
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
      lineAmountTypes,
      status,
      existingQuote,
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
