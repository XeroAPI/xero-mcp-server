import { RepeatingInvoice } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function fetchRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<RepeatingInvoice | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getRepeatingInvoice(
    xeroClient.tenantId,
    repeatingInvoiceId,
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

/**
 * Retrieve a single repeating invoice template from Xero
 */
export async function getXeroRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    const repeatingInvoice = await fetchRepeatingInvoice(repeatingInvoiceId);

    if (!repeatingInvoice) {
      return {
        result: null,
        isError: true,
        error: "Repeating invoice not found.",
      };
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
