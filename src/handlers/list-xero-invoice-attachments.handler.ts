import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Attachment } from "xero-node";

export async function listXeroInvoiceAttachments(
  invoiceId: string,
): Promise<XeroClientResponse<Attachment[]>> {
  try {
    await xeroClient.authenticate();

    const response = await xeroClient.accountingApi.getInvoiceAttachments(
      xeroClient.tenantId,
      invoiceId,
    );

    return {
      result: response.body.attachments ?? [],
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
