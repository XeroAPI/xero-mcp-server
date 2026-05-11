import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CreditNote, CurrencyCode, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface CreditNoteLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  tracking?: LineItemTracking[];
}

export type CreditNoteCreateExtras = {
  type?: "ACCRECCREDIT" | "ACCPAYCREDIT";
  date?: string;
  currencyCode?: string;
  currencyRate?: number;
  brandingThemeID?: string;
};

export type CreditNoteUpdateExtras = {
  dueDate?: string;
  currencyCode?: string;
  currencyRate?: number;
  brandingThemeID?: string;
};

export function applyCreditNoteCurrency(
  creditNote: CreditNote,
  currencyCode: string | undefined,
  currencyRate: number | undefined,
): void {
  if (currencyCode !== undefined) {
    const code = currencyCode.toUpperCase() as keyof typeof CurrencyCode;
    if (CurrencyCode[code] !== undefined) creditNote.currencyCode = CurrencyCode[code];
  }
  if (currencyRate !== undefined) creditNote.currencyRate = currencyRate;
}

async function createCreditNote(
  contactId: string,
  lineItems: CreditNoteLineItem[],
  reference: string | undefined,
  extras: CreditNoteCreateExtras | undefined,
): Promise<CreditNote | undefined> {
  await xeroClient.authenticate();

  const type = extras?.type
    ? CreditNote.TypeEnum[extras.type]
    : CreditNote.TypeEnum.ACCRECCREDIT;

  const creditNote: CreditNote = {
    type,
    contact: {
      contactID: contactId,
    },
    lineItems: lineItems,
    date: extras?.date ?? new Date().toISOString().split("T")[0],
    reference: reference,
    status: CreditNote.StatusEnum.DRAFT,
  };

  if (extras?.brandingThemeID !== undefined) creditNote.brandingThemeID = extras.brandingThemeID;
  applyCreditNoteCurrency(creditNote, extras?.currencyCode, extras?.currencyRate);

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
  lineItems: CreditNoteLineItem[],
  reference?: string,
  extras?: CreditNoteCreateExtras,
): Promise<XeroClientResponse<CreditNote>> {
  try {
    const createdCreditNote = await createCreditNote(
      contactId,
      lineItems,
      reference,
      extras,
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
