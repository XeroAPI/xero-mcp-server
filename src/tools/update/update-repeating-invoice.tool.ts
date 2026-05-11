import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { updateXeroRepeatingInvoice } from "../../handlers/update-xero-repeating-invoice.handler.js";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category."),
  option: z.string().describe("The name of the tracking option."),
  trackingCategoryID: z.string().describe("The ID of the tracking category."),
});

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string(),
  taxType: z.string(),
  itemCode: z.string().optional(),
  tracking: z.array(trackingSchema).optional(),
});

const scheduleSchema = z.object({
  period: z.number().int().min(1),
  unit: z.enum(["WEEKLY", "MONTHLY"]),
  dueDate: z.number().int().min(1),
  dueDateType: z.enum([
    "DAYSAFTERBILLDATE",
    "DAYSAFTERBILLMONTH",
    "DAYSAFTERINVOICEDATE",
    "DAYSAFTERINVOICEMONTH",
    "OFCURRENTMONTH",
    "OFFOLLOWINGMONTH",
  ]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const UpdateRepeatingInvoiceTool = CreateXeroTool(
  "update-repeating-invoice",
  "Update a repeating invoice template in Xero. Identify by repeatingInvoiceID. All other fields are optional — only what you pass is changed. \
Pass full lineItems array to replace existing items (Xero replaces, does not merge). \
Set status to AUTHORISED to start generating invoices, DRAFT to pause, or DELETED to soft-delete the template (Xero has no separate delete endpoint).",
  {
    repeatingInvoiceID: z.string(),
    contactId: z.string().optional().describe("Switch the template to a different contact."),
    type: z.enum(["ACCREC", "ACCPAY"]).optional(),
    schedule: scheduleSchema.optional(),
    lineItems: z
      .array(lineItemSchema)
      .optional()
      .describe(
        "Replaces the existing line items entirely. Provide all items you want kept.",
      ),
    reference: z.string().optional(),
    brandingThemeID: z.string().optional(),
    currencyCode: z.string().length(3).optional(),
    lineAmountTypes: z.enum(["INCLUSIVE", "EXCLUSIVE", "NOTAX"]).optional(),
    status: z
      .enum(["DRAFT", "AUTHORISED", "DELETED"])
      .optional()
      .describe(
        "DRAFT pauses generation. AUTHORISED activates generation. DELETED soft-deletes the template.",
      ),
    sendCopy: z.boolean().optional(),
    markAsSent: z.boolean().optional(),
    includePDF: z.boolean().optional(),
  },
  async ({
    repeatingInvoiceID,
    contactId,
    type,
    schedule,
    lineItems,
    reference,
    brandingThemeID,
    currencyCode,
    lineAmountTypes,
    status,
    sendCopy,
    markAsSent,
    includePDF,
  }) => {
    const response = await updateXeroRepeatingInvoice({
      repeatingInvoiceID,
      contactId,
      type,
      schedule,
      lineItems,
      reference,
      brandingThemeID,
      currencyCode,
      lineAmountTypes,
      status,
      sendCopy,
      markAsSent,
      includePDF,
    });

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating repeating invoice: ${response.error}`,
          },
        ],
      };
    }

    const ri = response.result;
    const sched = ri.schedule;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Repeating invoice updated: ${ri.repeatingInvoiceID}`,
            `Contact: ${ri.contact?.name}`,
            `Type: ${ri.type}`,
            `Status: ${ri.status}`,
            sched
              ? `Schedule: every ${sched.period} ${sched.unit}, due ${sched.dueDate} ${sched.dueDateType}`
              : null,
            sched?.nextScheduledDate ? `Next: ${sched.nextScheduledDate}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdateRepeatingInvoiceTool;
