import { z } from "zod";
import { downloadXeroInvoiceAttachment } from "../../handlers/download-xero-invoice-attachment.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const GetInvoiceAttachmentTool = CreateXeroTool(
  "get-invoice-attachment-content",
  `Download the content of a specific invoice attachment from Xero.
Returns the file content as base64-encoded text along with MIME type and content length.
Use list-invoice-attachments first to get the exact FileName and MIME type.
The fileName must match exactly (case-sensitive).
Requires the accounting.attachments.read scope on the Xero Custom Connection.`,
  {
    invoiceId: z.string().describe("The Xero Invoice ID (UUID)"),
    fileName: z
      .string()
      .describe("Exact filename from list-invoice-attachments"),
    contentType: z
      .string()
      .describe("MIME type from list-invoice-attachments (e.g. application/pdf, image/png)"),
  },
  async ({ invoiceId, fileName, contentType }) => {
    const response = await downloadXeroInvoiceAttachment(
      invoiceId,
      fileName,
      contentType,
    );

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error downloading attachment: ${response.error}`,
          },
        ],
      };
    }

    const result = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `File Name: ${result.fileName}`,
            `MIME Type: ${result.mimeType}`,
            `Content Length: ${result.contentLength} bytes`,
            `Encoding: base64`,
            `Content:`,
            result.base64,
          ].join("\n"),
        },
      ],
    };
  },
);

export default GetInvoiceAttachmentTool;
