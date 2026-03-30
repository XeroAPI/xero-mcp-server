import { Invoice } from "xero-node";
import { z } from "zod";
import { emailXeroInvoice } from "../../handlers/xero-invoice-workflow.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const EmailInvoiceTool = CreateXeroTool(
  "email-invoice",
  "Send an approved invoice to the related contact by email using Xero's invoice email endpoint. The invoice must already be AUTHORISED or PAID, and the related contact must have an email address in Xero.",
  {
    invoiceId: z.string().describe("The ID of the invoice to email."),
  },
  async ({ invoiceId }: { invoiceId: string }) => {
    const response = await emailXeroInvoice(invoiceId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error emailing invoice: ${response.error}`,
          },
        ],
      };
    }

    const { invoice } = response.result;
    const deepLink = invoice.invoiceID
      ? await getDeepLink(
          invoice.type === Invoice.TypeEnum.ACCREC ? DeepLinkType.INVOICE : DeepLinkType.BILL,
          invoice.invoiceID,
        )
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Invoice email sent successfully:",
            `ID: ${invoice.invoiceID}`,
            invoice.invoiceNumber ? `Number: ${invoice.invoiceNumber}` : null,
            `Type: ${invoice.type}`,
            `Status: ${invoice.status}`,
            `Marked as sent: ${invoice.sentToContact ? "Yes" : "No"}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default EmailInvoiceTool;
