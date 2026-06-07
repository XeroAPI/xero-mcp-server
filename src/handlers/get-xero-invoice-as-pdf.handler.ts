import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export interface InvoicePdfResult {
  mimeType: "application/pdf";
  contentLength: number;
  base64: string;
}

export async function getXeroInvoiceAsPdf(
  invoiceId: string,
): Promise<XeroClientResponse<InvoicePdfResult>> {
  try {
    await xeroClient.authenticate();

    const response = await xeroClient.accountingApi.getInvoiceAsPdf(
      xeroClient.tenantId,
      invoiceId,
      getClientHeaders(),
    );

    const buffer = response.body;

    return {
      result: {
        mimeType: "application/pdf",
        contentLength: buffer.length,
        base64: buffer.toString("base64"),
      },
      isError: false,
      error: null,
    };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
