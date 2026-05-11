import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createXeroAttachment } from "../../handlers/create-xero-attachment.handler.js";

const CreateAttachmentTool = CreateXeroTool(
  "create-attachment",
  `Upload a file as an attachment on a Xero invoice or bank transaction.
  The file is read from the local filesystem at filePath (absolute or relative
  to the server's working directory). If fileName is omitted, the basename of
  filePath is used.
  includeOnline only applies to invoices and controls whether the attachment
  is shown on the online invoice the customer sees.
  After upload, the entity's hasAttachments flag will be true.`,
  {
    entityType: z.enum(["invoice", "banktransaction"]).describe(
      "The type of entity to attach the file to. \"invoice\" for an Invoice (use the InvoiceID), \"banktransaction\" for a BankTransaction (use the BankTransactionID).",
    ),
    entityId: z
      .string()
      .describe("The ID of the invoice or bank transaction to attach the file to."),
    filePath: z
      .string()
      .describe(
        "Path to the file on the local filesystem. May be absolute or relative to the server's working directory.",
      ),
    fileName: z
      .string()
      .optional()
      .describe(
        "Optional override for the attachment's stored file name. Defaults to the basename of filePath.",
      ),
    includeOnline: z
      .boolean()
      .optional()
      .describe(
        "Invoices only: include the attachment on the online (customer-facing) invoice. Ignored for bank transactions.",
      ),
  },
  async ({ entityType, entityId, filePath, fileName, includeOnline }) => {
    const result = await createXeroAttachment(
      entityType,
      entityId,
      filePath,
      fileName,
      includeOnline,
    );

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error uploading attachment: ${result.error}`,
          },
        ],
      };
    }

    const attachment = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Attachment uploaded to ${entityType} ${entityId}:`,
            `Attachment ID: ${attachment.attachmentID}`,
            `File Name: ${attachment.fileName}`,
            attachment.mimeType ? `Mime Type: ${attachment.mimeType}` : null,
            attachment.contentLength !== undefined
              ? `Content Length: ${attachment.contentLength} bytes`
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

export default CreateAttachmentTool;
