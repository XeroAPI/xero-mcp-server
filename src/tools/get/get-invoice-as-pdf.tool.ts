import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { getXeroInvoiceAsPdf } from "../../handlers/get-xero-invoice-as-pdf.handler.js";

const GetInvoiceAsPdfTool = CreateXeroTool(
  "get-invoice-as-pdf",
  `Download a Xero invoice rendered as a PDF.
Returns base64-encoded PDF content (can be large).`,
  {
    invoiceId: z.string().describe("The Xero Invoice ID (UUID)"),
  },
  async ({ invoiceId }) => {
    const response = await getXeroInvoiceAsPdf(invoiceId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting invoice PDF: ${response.error}`,
          },
        ],
      };
    }

    const pdf = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Invoice ID: ${invoiceId}`,
            `MIME Type: ${pdf.mimeType}`,
            `Content Length: ${pdf.contentLength} bytes`,
            `Encoding: base64`,
            `Content:`,
            pdf.base64,
          ].join("\n"),
        },
      ],
    };
  },
);

export default GetInvoiceAsPdfTool;
