import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CreditNote } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface CreditNoteLineItem {
  description?: string;
  quantity?: number;
  unitAmount?: number;
  itemCode?: string;
  accountCode?: string;
  taxType?: string;
}

async function createCreditNote(
  contactId: string,
  lineItems: CreditNoteLineItem[] | undefined,
  type: CreditNote.TypeEnum,
  reference?: string,
  status: CreditNote.StatusEnum = CreditNote.StatusEnum.DRAFT,
): Promise<CreditNote | undefined> {
  await xeroClient.authenticate();

  const creditNote: CreditNote = {
    type,
    contact: {
      contactID: contactId,
    },
    ...(lineItems ? { lineItems } : {}),
    date: new Date().toISOString().split("T")[0], // Today's date
    ...(reference !== undefined
      ? type === CreditNote.TypeEnum.ACCPAYCREDIT
        ? { creditNoteNumber: reference }
        : { reference }
      : {}),
    status,
  };

  const response = await xeroClient.accountingApi.createCreditNotes(
    xeroClient.tenantId,
    {
      creditNotes: [creditNote],
    }, // creditNotes
    true, // summarizeErrors
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders(),
  );
  const createdCreditNote = response.body.creditNotes?.[0];
  return createdCreditNote;
}

/**
 * Create a new credit note in Xero
 */
export async function createXeroCreditNote(
  contactId: string,
  lineItems?: CreditNoteLineItem[],
  type: CreditNote.TypeEnum = CreditNote.TypeEnum.ACCRECCREDIT,
  reference?: string,
  status: CreditNote.StatusEnum = CreditNote.StatusEnum.DRAFT,
): Promise<XeroClientResponse<CreditNote>> {
  try {
    const createdCreditNote = await createCreditNote(
      contactId,
      lineItems,
      type,
      reference,
      status,
    );

    if (!createdCreditNote) {
      throw new Error("Credit note creation failed.");
    }

    return {
      result: createdCreditNote,
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
