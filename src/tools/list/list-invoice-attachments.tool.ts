import { z } from "zod";
import { listXeroInvoiceAttachments } from "../../handlers/list-xero-invoice-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListInvoiceAttachmentsTool = CreateXeroTool(
  "list-invoice-attachments",
  "List attachments for a specific invoice in Xero. \
  Returns attachment metadata including filename, MIME type, and file size. \
  Requires the accounting.attachments.read scope on the Xero Custom Connection. \
  Use the FileName from the results with download-invoice-attachment to download content.",
  {
    invoiceId: z.string().describe("The Xero Invoice ID (UUID)"),
  },
  async ({ invoiceId }) => {
    const response = await listXeroInvoiceAttachments(invoiceId);
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing invoice attachments: ${response.error}`,
          },
        ],
      };
    }

    const attachments = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${attachments?.length || 0} attachments:`,
        },
        ...(attachments?.map((attachment) => ({
          type: "text" as const,
          text: [
            `Attachment ID: ${attachment.attachmentID}`,
            `File Name: ${attachment.fileName}`,
            `MIME Type: ${attachment.mimeType}`,
            `Content Length: ${attachment.contentLength}`,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListInvoiceAttachmentsTool;
