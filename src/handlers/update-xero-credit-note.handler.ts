import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CreditNote } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface CreditNoteLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
}

async function getCreditNote(creditNoteId: string): Promise<CreditNote | null> {
  await xeroClient.authenticate();

  // First, get the current credit note to check its status
  const response = await xeroClient.accountingApi.getCreditNote(
    xeroClient.tenantId,
    creditNoteId, // creditNoteId
    undefined, // unitdp
    getClientHeaders(), // options
  );

  return response.body.creditNotes?.[0] ?? null;
}

async function updateCreditNote(
  creditNoteId: string,
  lineItems?: CreditNoteLineItem[],
  reference?: string,
  contactId?: string,
  date?: string,
): Promise<CreditNote | null> {
  const creditNote: CreditNote = {
    lineItems: lineItems,
    reference: reference,
    date: date,
    contact: contactId ? { contactID: contactId } : undefined,
  };

  const response = await xeroClient.accountingApi.updateCreditNote(
    xeroClient.tenantId,
    creditNoteId, // creditNoteId
    {
      creditNotes: [creditNote],
    }, // creditNotes
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders(), // options
  );

  return response.body.creditNotes?.[0] ?? null;
}

/**
 * Update an existing credit note in Xero
 */
export async function updateXeroCreditNote(
  creditNoteId: string,
  lineItems?: CreditNoteLineItem[],
  reference?: string,
  contactId?: string,
  date?: string,
): Promise<XeroClientResponse<CreditNote>> {
  try {
    const existingCreditNote = await getCreditNote(creditNoteId);

    const creditNoteStatus = existingCreditNote?.status;

    // Only allow updates to DRAFT credit notes
    if (creditNoteStatus !== CreditNote.StatusEnum.DRAFT) {
      return {
        result: null,
        isError: true,
        error: `Cannot update credit note because it is not a draft. Current status: ${creditNoteStatus}`,
      };
    }

    const updatedCreditNote = await updateCreditNote(
      creditNoteId,
      lineItems,
      reference,
      contactId,
      date,
    );

    if (!updatedCreditNote) {
      throw new Error("Credit note update failed.");
    }

    return {
      result: updatedCreditNote,
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