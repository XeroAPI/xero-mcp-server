import { z } from "zod";
import { createXeroRepeatingInvoice } from "../../handlers/create-xero-repeating-invoice.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category. Can be obtained from the list-tracking-categories tool"),
  option: z.string().describe("The name of the tracking option. Can be obtained from the list-tracking-categories tool"),
  trackingCategoryID: z.string().describe("The ID of the tracking category. Optional - Xero resolves the category and option from the name and option fields, so omit it rather than calling the list-tracking-categories tool to look one up.").optional(),
});

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z.string().describe("The account code of the line item - can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type of the line item - can be obtained from the list-tax-rates tool"),
  itemCode: z.string().describe("The item code of the line item - can be obtained from the list-items tool \
    If the item is not listed, add without an item code and ask the user if they would like to add an item code.").optional(),
  tracking: z.array(trackingSchema).describe("Up to 2 tracking categories and options can be added to the line item. \
    Can be obtained from the list-tracking-categories tool. \
    Only use if prompted by the user.").optional(),
});

const scheduleSchema = z.object({
  period: z.number().describe("How many units between invoices, e.g. 1 (every 1) or 2 (every 2)."),
  unit: z.enum(["WEEKLY", "MONTHLY"]).describe("The repeat unit."),
  startDate: z.string().describe("Date the first invoice is generated (YYYY-MM-DD)."),
  dueDate: z.number().describe("Payment-terms value used with dueDateType, e.g. 20 or 31.").optional(),
  dueDateType: z
    .enum([
      "DAYSAFTERBILLDATE",
      "DAYSAFTERBILLMONTH",
      "DAYSAFTERINVOICEDATE",
      "DAYSAFTERINVOICEMONTH",
      "OFCURRENTMONTH",
      "OFFOLLOWINGMONTH",
    ])
    .describe("Payment-terms type used with dueDate.")
    .optional(),
  endDate: z.string().describe("Optional date the schedule ends (YYYY-MM-DD).").optional(),
});

const CreateRepeatingInvoiceTool = CreateXeroTool(
  "create-repeating-invoice",
  "Create a repeating-invoice template in Xero. The template auto-generates invoices on the \
given schedule. Defaults to a DRAFT ACCREC (sales) template unless told otherwise.",
  {
    contactId: z.string().describe("The ID of the contact for the template. Can be obtained from the list-contacts tool."),
    schedule: scheduleSchema,
    lineItems: z.array(lineItemSchema),
    type: z.enum(["ACCREC", "ACCPAY"]).describe("ACCREC for sales templates, ACCPAY for bill templates. Default ACCREC.").optional(),
    status: z.enum(["DRAFT", "AUTHORISED"]).describe("DRAFT (default) or AUTHORISED.").optional(),
    reference: z.string().describe("A reference for the generated invoices.").optional(),
    brandingThemeId: z.string().describe("Optional branding theme ID.").optional(),
    currencyCode: z.string().describe("Optional ISO currency code, e.g. GBP.").optional(),
    lineAmountType: z.enum(["EXCLUSIVE", "INCLUSIVE", "NO_TAX"]).describe("Whether line amounts are tax exclusive, inclusive, or no tax.").optional(),
    approvedForSending: z.boolean().describe("Whether Xero emails the generated invoice to the contact.").optional(),
    sendCopy: z.boolean().describe("Whether to send a copy to the sender's email.").optional(),
    markAsSent: z.boolean().describe("Whether to mark the generated invoice as sent.").optional(),
    includePDF: z.boolean().describe("Whether to attach a PDF to the emailed invoice.").optional(),
  },
  async (params) => {
    const result = await createXeroRepeatingInvoice(params);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating repeating invoice: ${result.error}`,
          },
        ],
      };
    }

    const ri = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Repeating invoice created successfully:",
            `ID: ${ri?.repeatingInvoiceID}`,
            `Type: ${ri?.type}`,
            `Status: ${ri?.status}`,
            `Contact: ${ri?.contact?.name}`,
            ri?.schedule ? `Schedule: every ${ri.schedule.period} ${ri.schedule.unit}` : null,
            ri?.schedule?.nextScheduledDate ? `Next Scheduled: ${ri.schedule.nextScheduledDate}` : null,
            ri?.total != null ? `Total: ${ri.total}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateRepeatingInvoiceTool;
