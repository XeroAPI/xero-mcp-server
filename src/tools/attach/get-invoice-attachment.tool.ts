import { z } from "zod";
import { getAttachment } from "../../handlers/get-attachment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatDownloadedAttachment } from "../../helpers/attachment-formatter.js";

const GetInvoiceAttachmentTool = CreateXeroTool(
  "get-invoice-attachment",
  `Download a file attachment from an invoice or bill in Xero.
  Returns the file content as base64-encoded data along with filename and MIME type.
  Use list-invoice-attachments first to get the attachment ID.
  The agent can then process the base64 content (e.g., read PDF text, analyze images).`,
  {
    invoiceId: z.string().describe(
      "The ID of the invoice or bill containing the attachment. Can be obtained from create-invoice or list-invoices tools.",
    ),
    attachmentId: z.string().describe(
      "The ID of the attachment to download. Can be obtained from list-invoice-attachments tool.",
    ),
  },
  async ({ invoiceId, attachmentId }) => {
    const result = await getAttachment("invoice", invoiceId, attachmentId);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting attachment: ${result.error}`,
          },
        ],
      };
    }

    const attachment = result.result;

    if (!attachment) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Attachment ${attachmentId} not found.`,
          },
        ],
      };
    }

    const formattedDetails = formatDownloadedAttachment(
      attachment.fileName,
      attachment.mimeType,
      attachment.contentBase64,
    );

    return {
      content: [
        {
          type: "text" as const,
          text: formattedDetails,
        },
        {
          type: "text" as const,
          text: attachment.contentBase64,
        },
      ],
    };
  },
);

export default GetInvoiceAttachmentTool;
