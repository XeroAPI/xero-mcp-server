import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroAttachments } from "../../handlers/list-xero-attachments.handler.js";

const ListAttachmentsTool = CreateXeroTool(
  "list-attachments",
  `List file attachments on a Xero entity (invoice or bank transaction).
  Returns each attachment's ID, file name, mime type, content length, and the Xero URL.
  Use list-invoices or list-bank-transactions first to find the entity ID; the
  hasAttachments flag on those records indicates whether anything is attached.`,
  {
    entityType: z.enum(["invoice", "banktransaction"]).describe(
      "The type of entity to list attachments for. \"invoice\" for an Invoice (use the InvoiceID), \"banktransaction\" for a BankTransaction (use the BankTransactionID).",
    ),
    entityId: z
      .string()
      .describe("The ID of the invoice or bank transaction."),
  },
  async ({ entityType, entityId }) => {
    const response = await listXeroAttachments(entityType, entityId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing attachments: ${response.error}`,
          },
        ],
      };
    }

    const attachments = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${attachments?.length || 0} attachment(s) on ${entityType} ${entityId}:`,
        },
        ...(attachments?.map((attachment) => ({
          type: "text" as const,
          text: [
            `Attachment ID: ${attachment.attachmentID}`,
            `File Name: ${attachment.fileName}`,
            attachment.mimeType ? `Mime Type: ${attachment.mimeType}` : null,
            attachment.contentLength !== undefined
              ? `Content Length: ${attachment.contentLength} bytes`
              : null,
            attachment.includeOnline !== undefined
              ? `Include Online: ${attachment.includeOnline}`
              : null,
            attachment.url ? `URL: ${attachment.url}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListAttachmentsTool;
