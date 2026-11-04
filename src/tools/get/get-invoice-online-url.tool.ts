import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { getXeroInvoiceOnlineUrl } from "../../handlers/get-xero-invoice-online-url.handler.js";

const GetInvoiceOnlineUrlTool = CreateXeroTool(
  "get-invoice-online-url",
  `Get a shareable online URL for a Xero invoice.
Note: Xero may return no URL if the invoice is not enabled for online viewing / online payments.`,
  {
    invoiceId: z.string().describe("The Xero Invoice ID (UUID)"),
  },
  async ({ invoiceId }) => {
    const response = await getXeroInvoiceOnlineUrl(invoiceId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting online invoice URL: ${response.error}`,
          },
        ],
      };
    }

    const url = response.result;

    if (!url) {
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Invoice ID: ${invoiceId}`,
              `Online Invoice URL: (not available)`,
              ``,
              `Xero did not return an online URL for this invoice.`,
              `This usually means online viewing / online payments are not enabled for the invoice.`,
            ].join("\n"),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Invoice ID: ${invoiceId}`,
            `Online Invoice URL: ${url}`,
          ].join("\n"),
        },
      ],
    };
  },
);

export default GetInvoiceOnlineUrlTool;
