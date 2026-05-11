import path from "node:path";
import { promises as fs } from "node:fs";
import { Attachment } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export type AttachmentEntityType = "invoice" | "banktransaction";

async function uploadAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  filePath: string,
  fileName: string | undefined,
  includeOnline: boolean | undefined,
): Promise<Attachment | undefined> {
  const resolvedPath = path.resolve(filePath);
  const body = await fs.readFile(resolvedPath);
  const resolvedFileName = fileName ?? path.basename(resolvedPath);

  await xeroClient.authenticate();

  switch (entityType) {
    case "invoice": {
      const response =
        await xeroClient.accountingApi.createInvoiceAttachmentByFileName(
          xeroClient.tenantId,
          entityId,
          resolvedFileName,
          body,
          includeOnline,
          undefined, // idempotencyKey
          getClientHeaders(),
        );
      return response.body.attachments?.[0];
    }
    case "banktransaction": {
      const response =
        await xeroClient.accountingApi.createBankTransactionAttachmentByFileName(
          xeroClient.tenantId,
          entityId,
          resolvedFileName,
          body,
          undefined, // idempotencyKey
          getClientHeaders(),
        );
      return response.body.attachments?.[0];
    }
  }
}

export async function createXeroAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  filePath: string,
  fileName?: string,
  includeOnline?: boolean,
): Promise<XeroClientResponse<Attachment>> {
  try {
    const attachment = await uploadAttachment(
      entityType,
      entityId,
      filePath,
      fileName,
      includeOnline,
    );

    if (!attachment) {
      throw new Error("Attachment upload failed.");
    }

    return {
      result: attachment,
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
