import { z } from "zod";
import { updateXeroInvoice } from "../../handlers/update-xero-invoice.handler.js";
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
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z.string().describe("The account code of the line item - can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type of the line item - can be obtained from the list-tax-rates tool"),
  itemCode: z.string().describe("The item code of the line item - can be obtained from the list-items tool \
    If the item was not populated in the original invoice, \
    add without an item code unless the user has told you to add an item code.").optional(),
  tracking: z.array(trackingSchema).describe("Up to 2 tracking categories and options can be added to the line item. \
    Can be obtained from the list-tracking-categories tool. \
    Only use if prompted by the user.").optional(),
});

const UpdateInvoiceTool = CreateXeroTool(
  "update-invoice",
  "Update an invoice in Xero. Draft, submitted and authorised invoices can be updated.\
  Omit lineItems to leave the invoice's line items untouched.\
  When changing line items, all line items must be provided. Any line items not provided will be removed. Including existing line items.\
  Do not modify line items that have not been specified by the user.\
  An authorised invoice can only be updated while it has no payments, credit notes, prepayments or overpayments applied.\
 When an invoice is updated, a deep link to the invoice in Xero is returned. \
 This deep link can be used to view the contact in Xero directly. \
 This link should be displayed to the user.",
  {
    invoiceId: z.string().describe("The ID of the invoice to update."),
    lineItems: z.array(lineItemSchema).optional().describe(
      "Omit this argument to leave the invoice's line items untouched. \
      When changing line items, all line items must be provided. Any line items not provided will be removed. Including existing line items. \
      Do not modify line items that have not been specified by the user",
    ),
    reference: z.string().optional().describe("A reference number for the invoice."),
    dueDate: z.string().optional().describe("The due date of the invoice."),
    date: z.string().optional().describe("The date of the invoice."),
    contactId: z.string().optional().describe("The ID of the contact to update the invoice for. \
      Can be obtained from the list-contacts tool."),
    status: z.enum(["DRAFT", "SUBMITTED", "AUTHORISED", "DELETED", "VOIDED"]).optional().describe(
      "The status to set on the invoice. SUBMITTED submits a draft invoice for approval, DRAFT \
      returns a submitted invoice to draft, AUTHORISED approves a draft or submitted invoice, \
      DELETED removes a draft or submitted invoice, and VOIDED cancels an authorised invoice that \
      has no payments, credit notes, prepayments or overpayments applied. Omit to leave the status unchanged. \
      Xero ignores every other field sent alongside DELETED or VOIDED, so send those on their own.",
    ),
  },
  async (
    {
      invoiceId,
      lineItems,
      reference,
      dueDate,
      date,
      contactId,
      status,
    },
  ) => {
    const result = await updateXeroInvoice(
      invoiceId,
      lineItems,
      reference,
      dueDate,
      date,
      contactId,
      status as Invoice.StatusEnum | undefined,
    );
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating invoice: ${result.error}`,
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
            "Invoice updated successfully:",
            `ID: ${invoice?.invoiceID}`,
            `Contact: ${invoice?.contact?.name}`,
            `Type: ${invoice?.type}`,
            `Total: ${invoice?.total}`,
            `Status: ${invoice?.status}`,
            deepLink ? `Link to view: ${deepLink}` : null,
          ].join("\n"),
        },
      ],
    };
  },
);

export default UpdateInvoiceTool;
