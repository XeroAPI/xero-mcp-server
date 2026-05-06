import { Attachment, Attachments } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { formatBinaryContent } from "../helpers/format-binary-content.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { resolveStagedFileInput } from "../helpers/staged-file-upload.js";
import { loadConfig } from "../lib/config.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { XeroAttachmentObjectType } from "../types/xero-attachment-object-type.js";

type CreateAttachmentMethod = (
  tenantId: string,
  objectId: string,
  fileName: string,
  body: Buffer,
  contentType: string,
) => Promise<Attachments>;

type ListAttachmentMethod = (
  tenantId: string,
  objectId: string,
) => Promise<Attachments>;

type GetAttachmentByIdMethod = (
  tenantId: string,
  objectId: string,
  attachmentId: string,
  contentType: string,
) => Promise<Buffer>;

type GetAttachmentByFileNameMethod = (
  tenantId: string,
  objectId: string,
  fileName: string,
  contentType: string,
) => Promise<Buffer>;

export interface XeroAttachmentDocument {
  attachmentId?: string;
  fileName?: string;
  url?: string;
  contentType: string;
  contentLength?: number;
  includeOnline?: boolean;
  contentBase64: string;
  contentText?: string;
}

const createAttachmentHeaders = (
  contentType: string,
  contentLength: number,
) => ({
  headers: {
    ...getClientHeaders().headers,
    "Content-Type": contentType,
    "Content-Length": contentLength.toString(),
  },
});

const attachmentApiMethods: Record<
  XeroAttachmentObjectType,
  {
    create: CreateAttachmentMethod;
    list: ListAttachmentMethod;
    getById: GetAttachmentByIdMethod;
    getByFileName: GetAttachmentByFileNameMethod;
  }
> = {
  Invoices: {
    create: async (tenantId, objectId, fileName, body, contentType) =>
      (
        await xeroClient.accountingApi.createInvoiceAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          body,
          undefined,
          undefined,
          createAttachmentHeaders(contentType, body.byteLength),
        )
      ).body,
    list: async (tenantId, objectId) =>
      (
        await xeroClient.accountingApi.getInvoiceAttachments(
          tenantId,
          objectId,
          getClientHeaders(),
        )
      ).body,
    getById: async (tenantId, objectId, attachmentId, contentType) =>
      (
        await xeroClient.accountingApi.getInvoiceAttachmentById(
          tenantId,
          objectId,
          attachmentId,
          contentType,
          getClientHeaders(),
        )
      ).body,
    getByFileName: async (tenantId, objectId, fileName, contentType) =>
      (
        await xeroClient.accountingApi.getInvoiceAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          contentType,
          getClientHeaders(),
        )
      ).body,
  },
  BankTransactions: {
    create: async (tenantId, objectId, fileName, body, contentType) =>
      (
        await xeroClient.accountingApi.createBankTransactionAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          body,
          undefined,
          createAttachmentHeaders(contentType, body.byteLength),
        )
      ).body,
    list: async (tenantId, objectId) =>
      (
        await xeroClient.accountingApi.getBankTransactionAttachments(
          tenantId,
          objectId,
          getClientHeaders(),
        )
      ).body,
    getById: async (tenantId, objectId, attachmentId, contentType) =>
      (
        await xeroClient.accountingApi.getBankTransactionAttachmentById(
          tenantId,
          objectId,
          attachmentId,
          contentType,
          getClientHeaders(),
        )
      ).body,
    getByFileName: async (tenantId, objectId, fileName, contentType) =>
      (
        await xeroClient.accountingApi.getBankTransactionAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          contentType,
          getClientHeaders(),
        )
      ).body,
  },
  Contacts: {
    create: async (tenantId, objectId, fileName, body, contentType) =>
      (
        await xeroClient.accountingApi.createContactAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          body,
          undefined,
          createAttachmentHeaders(contentType, body.byteLength),
        )
      ).body,
    list: async (tenantId, objectId) =>
      (
        await xeroClient.accountingApi.getContactAttachments(
          tenantId,
          objectId,
          getClientHeaders(),
        )
      ).body,
    getById: async (tenantId, objectId, attachmentId, contentType) =>
      (
        await xeroClient.accountingApi.getContactAttachmentById(
          tenantId,
          objectId,
          attachmentId,
          contentType,
          getClientHeaders(),
        )
      ).body,
    getByFileName: async (tenantId, objectId, fileName, contentType) =>
      (
        await xeroClient.accountingApi.getContactAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          contentType,
          getClientHeaders(),
        )
      ).body,
  },
  CreditNotes: {
    create: async (tenantId, objectId, fileName, body, contentType) =>
      (
        await xeroClient.accountingApi.createCreditNoteAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          body,
          undefined,
          undefined,
          createAttachmentHeaders(contentType, body.byteLength),
        )
      ).body,
    list: async (tenantId, objectId) =>
      (
        await xeroClient.accountingApi.getCreditNoteAttachments(
          tenantId,
          objectId,
          getClientHeaders(),
        )
      ).body,
    getById: async (tenantId, objectId, attachmentId, contentType) =>
      (
        await xeroClient.accountingApi.getCreditNoteAttachmentById(
          tenantId,
          objectId,
          attachmentId,
          contentType,
          getClientHeaders(),
        )
      ).body,
    getByFileName: async (tenantId, objectId, fileName, contentType) =>
      (
        await xeroClient.accountingApi.getCreditNoteAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          contentType,
          getClientHeaders(),
        )
      ).body,
  },
  ManualJournals: {
    create: async (tenantId, objectId, fileName, body, contentType) =>
      (
        await xeroClient.accountingApi.createManualJournalAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          body,
          undefined,
          createAttachmentHeaders(contentType, body.byteLength),
        )
      ).body,
    list: async (tenantId, objectId) =>
      (
        await xeroClient.accountingApi.getManualJournalAttachments(
          tenantId,
          objectId,
          getClientHeaders(),
        )
      ).body,
    getById: async (tenantId, objectId, attachmentId, contentType) =>
      (
        await xeroClient.accountingApi.getManualJournalAttachmentById(
          tenantId,
          objectId,
          attachmentId,
          contentType,
          getClientHeaders(),
        )
      ).body,
    getByFileName: async (tenantId, objectId, fileName, contentType) =>
      (
        await xeroClient.accountingApi.getManualJournalAttachmentByFileName(
          tenantId,
          objectId,
          fileName,
          contentType,
          getClientHeaders(),
        )
      ).body,
  },
};

function getFirstAttachment(
  attachments: Attachments,
  fileName: string,
): Attachment {
  const attachment =
    attachments.attachments?.find((item) => item.fileName === fileName) ??
    attachments.attachments?.[0];

  if (!attachment) {
    throw new Error("Xero did not return attachment details.");
  }

  return attachment;
}

async function resolveAttachment(
  objectType: XeroAttachmentObjectType,
  objectId: string,
  attachmentId?: string,
  fileName?: string,
): Promise<Attachment> {
  const attachmentMethods = attachmentApiMethods[objectType];
  const response = await attachmentMethods.list(xeroClient.tenantId, objectId);
  const attachments = response.attachments ?? [];

  const attachment =
    (attachmentId
      ? attachments.find((item) => item.attachmentID === attachmentId)
      : undefined) ??
    (fileName
      ? attachments.find((item) => item.fileName === fileName)
      : undefined);

  if (!attachment) {
    throw new Error("Attachment not found in Xero.");
  }

  return attachment;
}

async function uploadAttachment(
  objectType: XeroAttachmentObjectType,
  objectId: string,
  fileName: string,
  stagedFileId: string,
): Promise<Attachment> {
  await xeroClient.authenticate();

  const resolvedFile = await resolveStagedFileInput(
    loadConfig().uploads,
    stagedFileId,
  );

  try {
    const body = resolvedFile.body;
    const attachmentMethods = attachmentApiMethods[objectType];
    const response = await attachmentMethods.create(
      xeroClient.tenantId,
      objectId,
      fileName,
      body,
      resolvedFile.contentType,
    );

    return getFirstAttachment(response, fileName);
  } finally {
    await resolvedFile.cleanup().catch(() => undefined);
  }
}

async function getAttachments(
  objectType: XeroAttachmentObjectType,
  objectId: string,
): Promise<Attachment[]> {
  await xeroClient.authenticate();

  const attachmentMethods = attachmentApiMethods[objectType];
  const response = await attachmentMethods.list(xeroClient.tenantId, objectId);

  return response.attachments ?? [];
}

async function getAttachmentDocument(
  objectType: XeroAttachmentObjectType,
  objectId: string,
  attachmentId?: string,
  fileName?: string,
  fallbackContentType?: string,
): Promise<XeroAttachmentDocument> {
  await xeroClient.authenticate();

  if (!attachmentId && !fileName) {
    throw new Error("Either attachmentId or fileName is required.");
  }

  const attachment = await resolveAttachment(
    objectType,
    objectId,
    attachmentId,
    fileName,
  );
  const resolvedContentType = attachment.mimeType ?? fallbackContentType;

  if (!resolvedContentType) {
    throw new Error(
      "Unable to determine the attachment content type. Provide contentType explicitly.",
    );
  }

  const attachmentMethods = attachmentApiMethods[objectType];
  const buffer =
    attachment.attachmentID && attachmentId
      ? await attachmentMethods.getById(
          xeroClient.tenantId,
          objectId,
          attachment.attachmentID,
          resolvedContentType,
        )
      : await attachmentMethods.getByFileName(
          xeroClient.tenantId,
          objectId,
          attachment.fileName ?? fileName ?? "",
          resolvedContentType,
        );
  const formattedContent = formatBinaryContent(buffer, resolvedContentType);

  return {
    attachmentId: attachment.attachmentID,
    fileName: attachment.fileName,
    url: attachment.url,
    contentType: resolvedContentType,
    contentLength: attachment.contentLength ?? buffer.byteLength,
    includeOnline: attachment.includeOnline,
    ...formattedContent,
  };
}

export async function addXeroAttachment(
  objectType: XeroAttachmentObjectType,
  objectId: string,
  fileName: string,
  stagedFileId: string,
): Promise<XeroClientResponse<Attachment>> {
  try {
    const attachment = await uploadAttachment(
      objectType,
      objectId,
      fileName,
      stagedFileId,
    );

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

export async function listXeroAttachments(
  objectType: XeroAttachmentObjectType,
  objectId: string,
): Promise<XeroClientResponse<Attachment[]>> {
  try {
    const attachments = await getAttachments(objectType, objectId);

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

export async function getXeroAttachmentDocument(
  objectType: XeroAttachmentObjectType,
  objectId: string,
  attachmentId?: string,
  fileName?: string,
  contentType?: string,
): Promise<XeroClientResponse<XeroAttachmentDocument>> {
  try {
    const document = await getAttachmentDocument(
      objectType,
      objectId,
      attachmentId,
      fileName,
      contentType,
    );

    return {
      result: document,
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
