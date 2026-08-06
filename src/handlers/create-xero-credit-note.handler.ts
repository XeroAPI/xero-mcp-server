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
  idempotencyKey?: string,
  date?: string,
  dueDate?: string,
  creditNoteNumber?: string,
): Promise<CreditNote | undefined> {
  await xeroClient.authenticate();

  const creditNote: CreditNote = {
    type,
    contact: {
      contactID: contactId,
    },
    ...(lineItems ? { lineItems } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(reference !== undefined
      ? type === CreditNote.TypeEnum.ACCPAYCREDIT
        ? { creditNoteNumber: reference }
        : { reference }
      : {}),
    ...(creditNoteNumber !== undefined ? { creditNoteNumber } : {}),
    status,
  };

  const response = await xeroClient.accountingApi.createCreditNotes(
    xeroClient.tenantId,
    {
      creditNotes: [creditNote],
    }, // creditNotes
    true, // summarizeErrors
    undefined, // unitdp
    idempotencyKey,
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
  idempotencyKey?: string,
  date?: string,
  dueDate?: string,
  creditNoteNumber?: string,
): Promise<XeroClientResponse<CreditNote>> {
  try {
    if (status === CreditNote.StatusEnum.AUTHORISED && (!lineItems || lineItems.length === 0)) {
      throw new Error("An authorised credit note requires at least one line item.");
    }
    if (
      creditNoteNumber !== undefined
      && type !== CreditNote.TypeEnum.ACCRECCREDIT
    ) {
      return {
        result: null,
        isError: true,
        error: "creditNoteNumber is only supported on ACCRECCREDIT customer credit notes. Use reference for supplier credit notes.",
      };
    }

    const createdCreditNote = await createCreditNote(
      contactId,
      lineItems,
      type,
      reference,
      status,
      idempotencyKey,
      date,
      dueDate,
      creditNoteNumber,
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
