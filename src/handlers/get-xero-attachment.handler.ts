import path from "node:path";
import { promises as fs } from "node:fs";

import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { AttachmentEntityType } from "./list-xero-attachments.handler.js";

export type DownloadedAttachment = {
  outputPath: string;
  fileName: string;
  mimeType: string;
  contentLength: number;
};

async function lookupAttachmentMeta(
  entityType: AttachmentEntityType,
  entityId: string,
  attachmentId: string,
): Promise<{ fileName: string; mimeType: string }> {
  switch (entityType) {
    case "invoice": {
      const response = await xeroClient.accountingApi.getInvoiceAttachments(
        xeroClient.tenantId,
        entityId,
        getClientHeaders(),
      );
      const match = response.body.attachments?.find(
        (a) => a.attachmentID === attachmentId,
      );
      if (!match) {
        throw new Error(
          `Attachment ${attachmentId} not found on invoice ${entityId}.`,
        );
      }
      return {
        fileName: match.fileName ?? attachmentId,
        mimeType: match.mimeType ?? "application/octet-stream",
      };
    }
    case "banktransaction": {
      const response =
        await xeroClient.accountingApi.getBankTransactionAttachments(
          xeroClient.tenantId,
          entityId,
          getClientHeaders(),
        );
      const match = response.body.attachments?.find(
        (a) => a.attachmentID === attachmentId,
      );
      if (!match) {
        throw new Error(
          `Attachment ${attachmentId} not found on bank transaction ${entityId}.`,
        );
      }
      return {
        fileName: match.fileName ?? attachmentId,
        mimeType: match.mimeType ?? "application/octet-stream",
      };
    }
  }
}

async function downloadBytes(
  entityType: AttachmentEntityType,
  entityId: string,
  attachmentId: string,
  mimeType: string,
): Promise<Buffer> {
  switch (entityType) {
    case "invoice": {
      const response =
        await xeroClient.accountingApi.getInvoiceAttachmentById(
          xeroClient.tenantId,
          entityId,
          attachmentId,
          mimeType,
          getClientHeaders(),
        );
      return response.body;
    }
    case "banktransaction": {
      const response =
        await xeroClient.accountingApi.getBankTransactionAttachmentById(
          xeroClient.tenantId,
          entityId,
          attachmentId,
          mimeType,
          getClientHeaders(),
        );
      return response.body;
    }
  }
}

async function resolveOutputPath(
  rawPath: string,
  fileName: string,
): Promise<string> {
  const resolved = path.resolve(rawPath);
  let isDir = false;
  try {
    const stat = await fs.stat(resolved);
    isDir = stat.isDirectory();
  } catch {
    // path doesn't exist yet — treat as a file path unless it has a trailing separator
    isDir = rawPath.endsWith(path.sep) || rawPath.endsWith("/");
    if (isDir) {
      await fs.mkdir(resolved, { recursive: true });
    }
  }
  return isDir ? path.join(resolved, fileName) : resolved;
}

export async function getXeroAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  attachmentId: string,
  outputPath: string,
): Promise<XeroClientResponse<DownloadedAttachment>> {
  try {
    await xeroClient.authenticate();

    const meta = await lookupAttachmentMeta(entityType, entityId, attachmentId);
    const bytes = await downloadBytes(
      entityType,
      entityId,
      attachmentId,
      meta.mimeType,
    );

    const target = await resolveOutputPath(outputPath, meta.fileName);
    await fs.writeFile(target, bytes);

    return {
      result: {
        outputPath: target,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        contentLength: bytes.length,
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
