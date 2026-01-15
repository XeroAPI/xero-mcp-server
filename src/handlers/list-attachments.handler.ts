import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Attachment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

/**
 * Entity types that support attachments
 */
export type AttachmentEntityType = "invoice" | "manualJournal";

/**
 * Generic handler to list attachments for any supported entity type
 */
export async function listAttachments(
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<XeroClientResponse<Attachment[]>> {
  try {
    await xeroClient.authenticate();

    let response;

    switch (entityType) {
      case "invoice":
        response = await xeroClient.accountingApi.getInvoiceAttachments(
          xeroClient.tenantId,
          entityId,
          getClientHeaders(),
        );
        break;

      case "manualJournal":
        response = await xeroClient.accountingApi.getManualJournalAttachments(
          xeroClient.tenantId,
          entityId,
          getClientHeaders(),
        );
        break;

      default:
        return {
          result: null,
          isError: true,
          error: `Unsupported entity type: ${entityType}`,
        };
    }

    return {
      result: response.body.attachments || [],
      isError: false,
      error: null,
    };
  } catch (error: unknown) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
