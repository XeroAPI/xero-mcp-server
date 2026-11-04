import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export async function getXeroInvoiceOnlineUrl(
  invoiceId: string,
): Promise<XeroClientResponse<string | null>> {
  try {
    await xeroClient.authenticate();

    const response = await xeroClient.accountingApi.getOnlineInvoice(
      xeroClient.tenantId,
      invoiceId,
      getClientHeaders(),
    );

    const url =
      response.body.onlineInvoices?.[0]?.onlineInvoiceUrl?.trim() || null;

    return { result: url, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
