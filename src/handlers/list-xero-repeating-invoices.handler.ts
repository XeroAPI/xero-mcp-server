import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { RepeatingInvoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getRepeatingInvoices(
  where?: string,
  order?: string,
): Promise<RepeatingInvoice[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getRepeatingInvoices(
    xeroClient.tenantId,
    where, // where
    order, // order
    getClientHeaders(),
  );

  return response.body.repeatingInvoices ?? [];
}

/**
 * List repeating-invoice templates from Xero
 */
export async function listXeroRepeatingInvoices(
  where?: string,
  order?: string,
): Promise<XeroClientResponse<RepeatingInvoice[]>> {
  try {
    const repeatingInvoices = await getRepeatingInvoices(where, order);

    return {
      result: repeatingInvoices,
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
