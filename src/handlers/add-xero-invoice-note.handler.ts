import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function addInvoiceNote(
  invoiceId: string,
  note: string,
): Promise<string | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.createInvoiceHistory(
    xeroClient.tenantId,
    invoiceId,
    {
      historyRecords: [{ details: note }],
    },
    undefined,
    getClientHeaders(),
  );

  return response.body.historyRecords?.[0]?.details;
}

export async function addXeroInvoiceNote(
  invoiceId: string,
  note: string,
): Promise<XeroClientResponse<string>> {
  try {
    const createdNote = await addInvoiceNote(invoiceId, note);

    if (!createdNote) {
      throw new Error("Invoice note creation failed.");
    }

    return {
      result: createdNote,
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
