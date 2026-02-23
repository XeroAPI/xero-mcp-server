import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface AttachmentDownload {
  fileName: string;
  mimeType: string;
  contentLength: number;
  base64: string;
}

export async function downloadXeroInvoiceAttachment(
  invoiceId: string,
  fileName: string,
  contentType: string,
): Promise<XeroClientResponse<AttachmentDownload>> {
  try {
    await xeroClient.authenticate();

    const response =
      await xeroClient.accountingApi.getInvoiceAttachmentByFileName(
        xeroClient.tenantId,
        invoiceId,
        fileName,
        contentType,
      );

    const buffer = response.body;

    return {
      result: {
        fileName,
        mimeType: contentType,
        contentLength: buffer.length,
        base64: buffer.toString("base64"),
      },
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
