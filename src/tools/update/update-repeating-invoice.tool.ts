import { z } from "zod";
import { updateXeroRepeatingInvoice } from "../../handlers/update-xero-repeating-invoice.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatRepeatingInvoice } from "../../helpers/format-repeating-invoice.js";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category."),
  option: z.string().describe("The name of the tracking option."),
  trackingCategoryID: z.string().describe("The ID of the tracking category."),
});

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z
    .string()
    .describe(
      "The account code of the line item - can be obtained from the list-accounts tool",
    ),
  taxType: z
    .string()
    .describe(
      "The tax type of the line item - can be obtained from the list-tax-rates tool",
    ),
  itemCode: z.string().optional(),
  tracking: z.array(trackingSchema).optional(),
});

const scheduleSchema = z.object({
  period: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("How often the invoice repeats, used with unit."),
  unit: z.enum(["WEEKLY", "MONTHLY"]).optional(),
  dueDate: z.number().int().optional(),
  dueDateType: z
    .enum([
      "DAYSAFTERBILLDATE",
      "DAYSAFTERBILLMONTH",
      "DAYSAFTERINVOICEDATE",
      "DAYSAFTERINVOICEMONTH",
      "OFCURRENTMONTH",
      "OFFOLLOWINGMONTH",
    ])
    .optional(),
  startDate: z
    .string()
    .optional()
    .describe("The first invoice date for this schedule (YYYY-MM-DD)."),
  endDate: z
    .string()
    .optional()
    .describe("Optional last invoice date for this schedule (YYYY-MM-DD)."),
});

const UpdateRepeatingInvoiceTool = CreateXeroTool(
  "update-repeating-invoice",
  "Update a repeating invoice template in Xero. Works on DRAFT and AUTHORISED templates. \
  All line items must be provided when changing lines. Any line items not provided will be removed. \
  Do not modify line items that have not been specified by the user. \
  Schedule changes apply to future generated invoices only. \
  Use status AUTHORISED to start generating invoices, or DELETED to delete the template.",
  {
    repeatingInvoiceId: z
      .string()
      .describe("The ID of the repeating invoice template to update."),
    lineItems: z
      .array(lineItemSchema)
      .optional()
      .describe(
        "All line items must be provided. Any line items not provided will be removed. \
Do not modify line items that have not been specified by the user.",
      ),
    schedule: scheduleSchema
      .optional()
      .describe("Replace or adjust the repeating schedule."),
    reference: z.string().optional(),
    contactId: z
      .string()
      .optional()
      .describe("Replace the contact on the repeating invoice."),
    type: z.enum(["ACCREC", "ACCPAY"]).optional(),
    status: z
      .enum(["DRAFT", "AUTHORISED", "DELETED"])
      .optional()
      .describe(
        "AUTHORISED starts generating invoices. DELETED removes the template.",
      ),
    lineAmountTypes: z.enum(["Exclusive", "Inclusive", "NoTax"]).optional(),
  },
  async (params) => {
    const result = await updateXeroRepeatingInvoice(params);
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating repeating invoice: ${result.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Repeating invoice updated successfully:",
            formatRepeatingInvoice(result.result, { includeLineItems: true }),
          ].join("\n"),
        },
      ],
    };
  },
);

export default UpdateRepeatingInvoiceTool;
