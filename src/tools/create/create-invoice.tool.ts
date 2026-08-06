import { z } from "zod";
import { createXeroInvoice } from "../../handlers/create-xero-invoice.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { Invoice } from "xero-node";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category. Can be obtained from the list-tracking-categories tool"),
  option: z.string().describe("The name of the tracking option. Can be obtained from the list-tracking-categories tool"),
  trackingCategoryID: z.string().describe("The ID of the tracking category. \
    Can be obtained from the list-tracking-categories tool"),
});

const lineItemSchema = z.object({
  description: z.string().min(1).describe("The description of the line item").optional(),
  quantity: z.number().describe("The quantity of the line item").optional(),
  unitAmount: z.number().describe("The price per unit of the line item").optional(),
  accountCode: z.string().describe("The account code of the line item - can be obtained from the list-accounts tool").optional(),
  taxType: z.string().describe("The tax type of the line item - can be obtained from the list-tax-rates tool").optional(),
  itemCode: z.string().describe("The item code of the line item - can be obtained from the list-items tool \
    If the item is not listed, add without an item code and ask the user if they would like to add an item code.").optional(),
  tracking: z.array(trackingSchema).describe("Up to 2 tracking categories and options can be added to the line item. \
    Can be obtained from the list-tracking-categories tool. \
    Only use if prompted by the user.").optional(),
  discountRate: z.number().optional().describe(
    "Optional percentage discount for an ACCREC sales-invoice line. Not supported for ACCPAY bills.",
  ),
  discountAmount: z.number().optional().describe(
    "Optional discount amount for an ACCREC sales-invoice line. Not supported for ACCPAY bills.",
  ),
}).refine((lineItem) => lineItem.description || lineItem.itemCode, {
  message: "A line item requires a description or item code.",
  path: ["description"],
});

const CreateInvoiceTool = CreateXeroTool(
  "create-invoice",
  "Create an invoice in Xero.\
 When an invoice is created, a deep link to the invoice in Xero is returned. \
 This deep link can be used to view the invoice in Xero directly. \
 This link should be displayed to the user.",
  {
    contactId: z.string().describe("The ID of the contact to create the invoice for. \
      Can be obtained from the list-contacts tool."),
    lineItems: z.array(lineItemSchema).min(1),
    type: z.enum(["ACCREC", "ACCPAY"]).describe("The type of invoice to create. \
      ACCREC is for sales invoices, Accounts Receivable, or customer invoices. \
      ACCPAY is for purchase invoices, Accounts Payable invoices, supplier invoices, or bills. \
      If the type is not specified, the default is ACCREC.").optional(),
    reference: z.string().describe("A reference number for the invoice.").optional(),
    date: z.string().describe("Optional issue date (YYYY-MM-DD). When omitted, Xero uses the current date in the organisation's timezone.").optional(),
    dueDate: z.string().describe("Optional due date for the invoice (YYYY-MM-DD format). When omitted, no due date is sent to Xero.").optional(),
    expectedPaymentDate: z.string().optional().describe(
      "Expected payment date for an ACCREC sales invoice (YYYY-MM-DD).",
    ),
    plannedPaymentDate: z.string().optional().describe(
      "Planned payment date for an ACCPAY bill (YYYY-MM-DD).",
    ),
    status: z.enum(["DRAFT", "SUBMITTED", "AUTHORISED"]).describe(
      "Optional initial invoice status. Use AUTHORISED only when the invoice is ready to be approved.",
    ).optional(),
    idempotencyKey: z.string().min(1).max(128).optional().describe(
      "Optional retry key. Reuse the same key when retrying this exact invoice to prevent duplicates.",
    ),
  },
  async ({
    contactId,
    lineItems,
    type,
    reference,
    date,
    dueDate,
    expectedPaymentDate,
    plannedPaymentDate,
    status,
    idempotencyKey,
  }) => {
    const xeroInvoiceType = type === "ACCPAY" ? Invoice.TypeEnum.ACCPAY : Invoice.TypeEnum.ACCREC;
    if (expectedPaymentDate !== undefined && xeroInvoiceType !== Invoice.TypeEnum.ACCREC) {
      return {
        content: [{
          type: "text" as const,
          text: "Error creating invoice: Expected payment dates are only supported on ACCREC sales invoices.",
        }],
      };
    }
    if (plannedPaymentDate !== undefined && xeroInvoiceType !== Invoice.TypeEnum.ACCPAY) {
      return {
        content: [{
          type: "text" as const,
          text: "Error creating invoice: Planned payment dates are only supported on ACCPAY bills.",
        }],
      };
    }

    const result = await createXeroInvoice(
      contactId,
      lineItems,
      xeroInvoiceType,
      reference,
      date,
      idempotencyKey,
      dueDate,
      status ? Invoice.StatusEnum[status] : undefined,
      expectedPaymentDate,
      plannedPaymentDate,
    );
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating invoice: ${result.error}`,
          },
        ],
      };
    }

    const invoice = result.result;

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
            "Invoice created successfully:",
            `ID: ${invoice?.invoiceID}`,
            `Contact: ${invoice?.contact?.name}`,
            `Type: ${invoice?.type}`,
            `Date: ${invoice?.date}`,
            invoice?.dueDate ? `Due Date: ${invoice.dueDate}` : null,
            invoice?.expectedPaymentDate
              ? `Expected Payment Date: ${invoice.expectedPaymentDate}`
              : null,
            invoice?.plannedPaymentDate
              ? `Planned Payment Date: ${invoice.plannedPaymentDate}`
              : null,
            `Total: ${invoice?.total}`,
            `Status: ${invoice?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateInvoiceTool;
