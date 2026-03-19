import { z } from "zod";

import { addXeroAttachment } from "../../handlers/xero-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { xeroAttachmentObjectTypes } from "../../types/xero-attachment-object-type.js";

const AddAttachmentTool = CreateXeroTool(
  "add-attachment",
  "Upload a base64-encoded file attachment directly to a specific Xero object such as an invoice, bill, bank transaction, contact, credit note, or manual journal. This is different from `upload-file`, which stores a standalone document in Xero Files. Use objectType `Invoices` for both ACCREC invoices and ACCPAY bills.",
  {
    objectType: z
      .enum(xeroAttachmentObjectTypes)
      .describe(
        "The type of Xero object to attach the file to. Use `Invoices` for both sales invoices and bills.",
      ),
    objectId: z
      .string()
      .describe("The Xero object ID to attach the file to."),
    fileName: z
      .string()
      .describe("The filename to store in Xero, for example invoice-2026-02.pdf."),
    fileContent: z
      .string()
      .describe("The base64-encoded file content. Data URLs are also accepted."),
    contentType: z
      .string()
      .describe("The MIME type of the file, for example application/pdf or image/png."),
  },
  async ({ objectType, objectId, fileName, fileContent, contentType }) => {
    const response = await addXeroAttachment(
      objectType,
      objectId,
      fileName,
      fileContent,
      contentType,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error uploading attachment: ${response.error}`,
          },
        ],
      };
    }

    const attachment = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Attachment uploaded successfully:",
            `Object Type: ${objectType}`,
            `Object ID: ${objectId}`,
            `Attachment ID: ${attachment.attachmentID ?? "Unknown"}`,
            `File: ${attachment.fileName ?? fileName}`,
            `Content Type: ${attachment.mimeType ?? contentType}`,
            attachment.contentLength !== undefined
              ? `Size: ${attachment.contentLength} bytes`
              : null,
            attachment.url ? `URL: ${attachment.url}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default AddAttachmentTool;
