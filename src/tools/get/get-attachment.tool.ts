import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { getXeroAttachment } from "../../handlers/get-xero-attachment.handler.js";

const GetAttachmentTool = CreateXeroTool(
  "get-attachment",
  `Download a file attachment from a Xero invoice or bank transaction and write
  it to the local filesystem. Use list-attachments first to find the
  attachmentId. outputPath may be a full file path or a directory; if it's a
  directory (or ends with a separator) the attachment's original file name is
  appended.`,
  {
    entityType: z.enum(["invoice", "banktransaction"]).describe(
      "The type of entity the attachment belongs to. \"invoice\" for an Invoice (use the InvoiceID), \"banktransaction\" for a BankTransaction (use the BankTransactionID).",
    ),
    entityId: z
      .string()
      .describe("The ID of the invoice or bank transaction."),
    attachmentId: z
      .string()
      .describe("The Xero AttachmentID of the file to download."),
    outputPath: z
      .string()
      .describe(
        "Where to write the downloaded file. May be a full file path, or a directory in which case the attachment's original file name is used.",
      ),
  },
  async ({ entityType, entityId, attachmentId, outputPath }) => {
    const result = await getXeroAttachment(
      entityType,
      entityId,
      attachmentId,
      outputPath,
    );

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error downloading attachment: ${result.error}`,
          },
        ],
      };
    }

    const { outputPath: writtenPath, fileName, mimeType, contentLength } =
      result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Attachment downloaded from ${entityType} ${entityId}:`,
            `Saved to: ${writtenPath}`,
            `File Name: ${fileName}`,
            `Mime Type: ${mimeType}`,
            `Content Length: ${contentLength} bytes`,
          ].join("\n"),
        },
      ],
    };
  },
);

export default GetAttachmentTool;
