import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { RepeatingInvoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<RepeatingInvoice | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getRepeatingInvoice(
    xeroClient.tenantId,
    repeatingInvoiceId, // repeatingInvoiceID
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

/**
 * Get a single repeating-invoice template (incl. line items) from Xero
 */
export async function getXeroRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    const repeatingInvoice = await getRepeatingInvoice(repeatingInvoiceId);

    if (!repeatingInvoice) {
      throw new Error("Repeating invoice not found.");
    }

    return {
      result: repeatingInvoice,
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
