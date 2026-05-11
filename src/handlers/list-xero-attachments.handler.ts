import { xeroClient } from "../clients/xero-client.js";
import { Attachment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export type AttachmentEntityType = "invoice" | "banktransaction";

async function getAttachments(
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<Attachment[]> {
  await xeroClient.authenticate();

  switch (entityType) {
    case "invoice": {
      const response = await xeroClient.accountingApi.getInvoiceAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      return response.body.attachments ?? [];
    }
    case "banktransaction": {
      const response =
        await xeroClient.accountingApi.getBankTransactionAttachments(
          xeroClient.tenantId,
          entityId,
          getClientHeaders(),
        );
      return response.body.attachments ?? [];
    }
  }
}

export async function listXeroAttachments(
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<XeroClientResponse<Attachment[]>> {
  try {
    const attachments = await getAttachments(entityType, entityId);
    return {
      result: attachments,
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
