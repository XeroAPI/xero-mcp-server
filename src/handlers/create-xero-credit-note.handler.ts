import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CreditNote } from "xero-node";

interface CreditNoteLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
}

/**
 * Create a new credit note in Xero
 */
export async function createXeroCreditNote(
  contactId: string,
  lineItems: CreditNoteLineItem[],
  reference?: string,
): Promise<ToolResponse<CreditNote>> {
  try {
    await xeroClient.authenticate();

    const creditNote: CreditNote = {
      type: CreditNote.TypeEnum.ACCRECCREDIT,
      contact: {
        contactID: contactId,
      },
      lineItems: lineItems,
      date: new Date().toISOString().split("T")[0], // Today's date
      reference: reference,
      status: CreditNote.StatusEnum.DRAFT,
    };

    const response = await xeroClient.accountingApi.createCreditNotes("", {
      creditNotes: [creditNote],
    });

    const createdCreditNote = response.body.creditNotes?.[0];

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