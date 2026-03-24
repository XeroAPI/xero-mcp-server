import { Invoice } from "xero-node";
import { z } from "zod";
import { approveAndEmailXeroInvoice } from "../../handlers/xero-invoice-workflow.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const ApproveAndEmailInvoiceTool = CreateXeroTool(
  "approve-and-email-invoice",
  "Approve an invoice in Xero and then send it to the related contact by email in one step. Draft and submitted invoices will be approved first. Already approved invoices will be emailed directly. The related contact must have an email address in Xero.",
  {
    invoiceId: z.string().describe("The ID of the invoice to approve and email."),
  },
  async ({ invoiceId }: { invoiceId: string }) => {
    const response = await approveAndEmailXeroInvoice(invoiceId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error approving and emailing invoice: ${response.error}`,
          },
        ],
      };
    }

    const { invoice, approved, emailed } = response.result;
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
            "Invoice workflow completed successfully:",
            `ID: ${invoice.invoiceID}`,
            invoice.invoiceNumber ? `Number: ${invoice.invoiceNumber}` : null,
            `Type: ${invoice.type}`,
            `Status: ${invoice.status}`,
            `Approved in this call: ${approved ? "Yes" : "No"}`,
            `Emailed in this call: ${emailed ? "Yes" : "No"}`,
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

export default ApproveAndEmailInvoiceTool;
