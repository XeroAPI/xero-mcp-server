import { z } from "zod";

import { listXeroAttachments } from "../../handlers/xero-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { xeroAttachmentObjectTypes } from "../../types/xero-attachment-object-type.js";

const ListAttachmentsTool = CreateXeroTool(
  "list-attachments",
  "List file attachments for a Xero invoice, bill, bank transaction, contact, credit note, or manual journal. Use objectType `Invoices` for both ACCREC invoices and ACCPAY bills.",
  {
    objectType: z
      .enum(xeroAttachmentObjectTypes)
      .describe(
        "The type of Xero object whose attachments should be listed. Use `Invoices` for both sales invoices and bills.",
      ),
    objectId: z
      .string()
      .describe("The Xero object ID whose attachments should be listed."),
  },
  async ({ objectType, objectId }) => {
    const response = await listXeroAttachments(objectType, objectId);

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

    if (attachments.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No attachments found for ${objectType} ${objectId}.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${attachments.length} attachment${attachments.length === 1 ? "" : "s"} for ${objectType} ${objectId}:`,
        },
        ...attachments.map((attachment) => ({
          type: "text" as const,
          text: [
            `Attachment ID: ${attachment.attachmentID ?? "Unknown"}`,
            `File: ${attachment.fileName ?? "Unknown"}`,
            attachment.mimeType ? `Content Type: ${attachment.mimeType}` : null,
            attachment.contentLength !== undefined
              ? `Size: ${attachment.contentLength} bytes`
              : null,
            attachment.includeOnline !== undefined
              ? `Include Online: ${attachment.includeOnline ? "Yes" : "No"}`
              : null,
            attachment.url ? `URL: ${attachment.url}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })),
      ],
    };
  },
);

export default ListAttachmentsTool;
