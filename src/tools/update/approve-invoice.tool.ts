import { Invoice } from "xero-node";
import { z } from "zod";
import { approveXeroInvoice } from "../../handlers/xero-invoice-workflow.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const ApproveInvoiceTool = CreateXeroTool(
  "approve-invoice",
  "Approve an invoice or bill in Xero by setting its status to AUTHORISED. This works for invoices that are currently DRAFT or SUBMITTED. If the invoice is already AUTHORISED or PAID, the tool returns the current invoice without making a change.",
  {
    invoiceId: z.string().describe("The ID of the invoice or bill to approve."),
  },
  async ({ invoiceId }: { invoiceId: string }) => {
    const response = await approveXeroInvoice(invoiceId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error approving invoice: ${response.error}`,
          },
        ],
      };
    }

    const { invoice, approved } = response.result;
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
            approved
              ? "Invoice approved successfully:"
              : "Invoice was already approved:",
            `ID: ${invoice.invoiceID}`,
            invoice.invoiceNumber ? `Number: ${invoice.invoiceNumber}` : null,
            `Type: ${invoice.type}`,
            `Status: ${invoice.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default ApproveInvoiceTool;
