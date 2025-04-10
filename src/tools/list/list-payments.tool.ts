import { z } from "zod";
import { listXeroPayments } from "../../handlers/list-xero-payments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import paymentFormatter from "../../helpers/formatters/payment.formatter.js";

const ListPaymentsTool = CreateXeroTool(
  "list-payments",
  `List payments in Xero. 
  This tool shows all payments made against invoices, including payment date, amount, and payment method.
  You can filter payments by invoice number, invoice ID, contact ID, payment ID, or invoice reference.
  Ask the user if they want to see payments for a specific invoice, contact, payment or reference before running.
  If many payments are returned, ask the user if they want to see the next page.`,
  {
    page: z.number().default(1),
    invoiceNumber: z.string().optional(),
    invoiceId: z.string().optional(),
    contactId: z.string().optional(),
    paymentId: z.string().optional(),
    reference: z.string().optional(),
  },
  async ({
    page,
    invoiceNumber,
    invoiceId,
    contactId,
    paymentId,
    reference,
  }) => {
    const response = await listXeroPayments(page, {
      invoiceNumber,
      invoiceId,
      contactId,
      paymentId,
      reference,
    });

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing payments: ${response.error}`,
          },
        ],
      };
    }

    const payments = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${payments?.length || 0} payments:`,
        },
        ...(payments?.map((payment) => ({
          type: "text" as const,
          text: paymentFormatter(payment),
        })) || []),
      ],
    };
  },
);

export default ListPaymentsTool;
