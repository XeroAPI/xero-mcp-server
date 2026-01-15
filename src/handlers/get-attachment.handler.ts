import { Attachment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { xeroClient } from "../clients/xero-client.js";
import { AttachmentEntityType } from "./list-attachments.handler.js";

/**
 * Result type for downloaded attachments
 */
export interface DownloadedAttachment {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

/**
 * Generic handler to get/download an attachment from any supported entity type
 */
export async function getAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  attachmentId: string,
): Promise<XeroClientResponse<DownloadedAttachment>> {
  try {
    await xeroClient.authenticate();

    let contentResponse;
    let metadataResponse;

    switch (entityType) {
      case "invoice":
        contentResponse =
          await xeroClient.accountingApi.getInvoiceAttachmentById(
            xeroClient.tenantId,
            entityId,
            attachmentId,
            "application/octet-stream",
            getClientHeaders(),
          );

        metadataResponse =
          await xeroClient.accountingApi.getInvoiceAttachments(
            xeroClient.tenantId,
            entityId,
            getClientHeaders(),
          );
        break;

      case "manualJournal":
        contentResponse =
          await xeroClient.accountingApi.getManualJournalAttachmentById(
            xeroClient.tenantId,
            entityId,
            attachmentId,
            "application/octet-stream",
            getClientHeaders(),
          );

        metadataResponse =
          await xeroClient.accountingApi.getManualJournalAttachments(
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

    if (!contentResponse.body) {
      return {
        result: null,
        isError: true,
        error: "No attachment content returned from Xero API",
      };
    }

    const attachment = metadataResponse.body.attachments?.find(
      (att: Attachment) => att.attachmentID === attachmentId,
    );

    if (!attachment) {
      return {
        result: null,
        isError: true,
        error: `Attachment ${attachmentId} not found on ${entityType} ${entityId}`,
      };
    }

    const buffer = Buffer.from(contentResponse.body as Buffer);
    const contentBase64 = buffer.toString("base64");

    return {
      result: {
        fileName: attachment.fileName || "unknown",
        mimeType: attachment.mimeType || "application/octet-stream",
        contentBase64,
      },
      isError: false,
      error: null,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      result: null,
      isError: true,
      error: `Failed to get attachment: ${errorMessage}`,
    };
  }
}
