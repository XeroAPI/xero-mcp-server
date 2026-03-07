import { z } from "zod";
import { listAttachments } from "../../handlers/list-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatAttachmentList } from "../../helpers/attachment-formatter.js";

const ListInvoiceAttachmentsTool = CreateXeroTool(
  "list-invoice-attachments",
  `List all file attachments on an invoice or bill in Xero.
  Returns metadata about each attachment including filename, size, MIME type, and attachment ID.
  Use this to see what files are attached before downloading them.`,
  {
    invoiceId: z.string().describe(
      "The ID of the invoice or bill to list attachments for. Can be obtained from create-invoice or list-invoices tools.",
    ),
  },
  async ({ invoiceId }) => {
    const result = await listAttachments("invoice", invoiceId);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing attachments: ${result.error}`,
          },
        ],
      };
    }

    const attachments = result.result;

    if (!attachments || attachments.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No attachments found on invoice ${invoiceId}.`,
          },
        ],
      };
    }

    const attachmentList = formatAttachmentList(attachments, {
      includeOnline: true,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Found ${attachments.length} attachment(s) on invoice ${invoiceId}:`,
            "",
            attachmentList,
          ].join("\n"),
        },
      ],
    };
  },
);

export default ListInvoiceAttachmentsTool;
