import { z } from "zod";
import { createXeroPayment } from "../../handlers/create-xero-payment.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const CreatePaymentTool = CreateXeroTool(
  "create-payment",
  "Create a payment against an invoice in Xero.\
 This tool records a payment transaction against an invoice. \
 You'll need to provide the invoice ID, account ID to make the payment from, and the amount. \
 The amount must be positive and should not exceed the remaining amount due on the invoice. \
 A payment can only be created for an invoice that is status AUTHORIZED \
 A payment can only be created for an invoice that is not fully paid \
 When a payment is created, a deep link to the payment in Xero is returned. \
 This deep link can be used to view the payment in Xero directly. \
 This link should be displayed to the user.",
  {
    invoiceId: z.string().describe("The ID of the invoice to pay"),
    accountId: z
      .string()
      .describe("The ID of the account the payment is made from"),
    amount: z
      .number()
      .positive()
      .describe("The amount of the payment (must be positive)"),
    date: z
      .string()
      .optional()
      .describe("Optional payment date in YYYY-MM-DD format"),
    reference: z
      .string()
      .optional()
      .describe("Optional payment reference/description"),
  },
  async ({ invoiceId, accountId, amount, date, reference }) => {
    const result = await createXeroPayment({
      invoiceId,
      accountId,
      amount,
      date,
      reference,
    });
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating payment: ${result.error}`,
          },
        ],
      };
    }

    const payment = result.result;

    const deepLink = payment.paymentID
      ? await getDeepLink(DeepLinkType.PAYMENT, payment.paymentID)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Invoice created successfully:",
            `ID: ${payment?.paymentID}`,
            `Reference: ${payment?.reference}`,
            `Invoice Number: ${payment?.invoiceNumber}`,
            `Amount: ${payment?.amount}`,
            `Status: ${payment?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreatePaymentTool;
