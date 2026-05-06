import { z } from "zod";

import { addXeroAttachment } from "../../handlers/xero-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { xeroAttachmentObjectTypes } from "../../types/xero-attachment-object-type.js";

const AddAttachmentTool = CreateXeroTool(
  "add-attachment",
  "Upload a previously staged file attachment directly to a specific Xero object such as an invoice, bill, bank transaction, contact, credit note, or manual journal. First call `prepare-file-upload`, then Cowork uploads the selected file to the returned uploadUrl, then call this tool with stagedFileId. Do not send base64 file content or local file paths. This is different from `upload-file`, which stores a standalone document in Xero Files. Use objectType `Invoices` for both ACCREC invoices and ACCPAY bills.",
  {
    objectType: z
      .enum(xeroAttachmentObjectTypes)
      .describe(
        "The type of Xero object to attach the file to. Use `Invoices` for both sales invoices and bills.",
      ),
    objectId: z.string().describe("The Xero object ID to attach the file to."),
    fileName: z
      .string()
      .describe(
        "The filename to store in Xero, for example invoice-2026-02.pdf.",
      ),
    stagedFileId: z
      .string()
      .describe(
        "The staged upload ID returned by prepare-file-upload after Cowork has uploaded the file bytes to uploadUrl.",
      ),
  },
  async ({ objectType, objectId, fileName, stagedFileId }) => {
    const response = await addXeroAttachment(
      objectType,
      objectId,
      fileName,
      stagedFileId,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error uploading attachment:\n${response.error}`,
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
            `Content Type: ${attachment.mimeType ?? "Unknown"}`,
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
