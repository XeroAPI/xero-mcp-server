import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createXeroRepeatingInvoice } from "../../handlers/create-xero-repeating-invoice.handler.js";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category. Can be obtained from the list-tracking-categories tool"),
  option: z.string().describe("The name of the tracking option. Can be obtained from the list-tracking-categories tool"),
  trackingCategoryID: z.string().describe("The ID of the tracking category. Can be obtained from the list-tracking-categories tool"),
});

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitAmount: z.number(),
  accountCode: z.string().describe("Account code from list-accounts."),
  taxType: z.string().describe("Tax type from list-tax-rates."),
  itemCode: z.string().optional().describe("Item code from list-items."),
  tracking: z.array(trackingSchema).optional().describe("Up to 2 tracking categories. Only use if prompted by the user."),
});

const scheduleSchema = z.object({
  period: z
    .number()
    .int()
    .min(1)
    .describe("Number of units between invoices, e.g. 1 = every period, 2 = every other."),
  unit: z
    .enum(["WEEKLY", "MONTHLY"])
    .describe("Schedule frequency. WEEKLY or MONTHLY."),
  dueDate: z
    .number()
    .int()
    .min(1)
    .describe(
      "Day of month/period used with dueDateType. E.g. 20 = 20th, 31 = end of month.",
    ),
  dueDateType: z
    .enum([
      "DAYSAFTERBILLDATE",
      "DAYSAFTERBILLMONTH",
      "DAYSAFTERINVOICEDATE",
      "DAYSAFTERINVOICEMONTH",
      "OFCURRENTMONTH",
      "OFFOLLOWINGMONTH",
    ])
    .describe(
      "How the due date is calculated. Common: DAYSAFTERINVOICEDATE (net-N), OFFOLLOWINGMONTH (e.g. 15th of next month).",
    ),
  startDate: z
    .string()
    .optional()
    .describe("Date the first invoice generates (YYYY-MM-DD). Defaults to today."),
  endDate: z
    .string()
    .optional()
    .describe("Optional end date when the template should stop generating invoices (YYYY-MM-DD)."),
});

const CreateRepeatingInvoiceTool = CreateXeroTool(
  "create-repeating-invoice",
  "Create a repeating invoice template in Xero. Templates auto-generate invoices on a schedule (e.g. monthly retainers). \
Use status DRAFT to stage the template (no invoices generated yet) or AUTHORISED to start generating immediately. \
For auto-emailed retainers, set markAsSent + sendCopy + includePDF and AUTHORISED.",
  {
    contactId: z.string().describe("Contact ID from list-contacts."),
    type: z
      .enum(["ACCREC", "ACCPAY"])
      .describe("ACCREC = customer recurring invoice (sales). ACCPAY = recurring bill (purchase)."),
    schedule: scheduleSchema,
    lineItems: z.array(lineItemSchema).min(1),
    reference: z.string().optional().describe("ACCREC only — additional reference number."),
    brandingThemeID: z.string().optional(),
    currencyCode: z.string().length(3).optional().describe("ISO 4217 (e.g. USD)."),
    lineAmountTypes: z
      .enum(["INCLUSIVE", "EXCLUSIVE", "NOTAX"])
      .optional()
      .describe("How line amounts treat tax. Defaults to EXCLUSIVE if omitted."),
    status: z
      .enum(["DRAFT", "AUTHORISED"])
      .optional()
      .describe("DRAFT (default) stages the template; AUTHORISED starts generating invoices on schedule."),
    sendCopy: z.boolean().optional().describe("Send a copy of generated invoices to the sender's email."),
    markAsSent: z.boolean().optional().describe("Mark generated invoices as 'sent' in Xero."),
    includePDF: z.boolean().optional().describe("Attach a PDF to auto-emailed generated invoices."),
  },
  async ({
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
    const response = await createXeroRepeatingInvoice({
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
            text: `Error creating repeating invoice: ${response.error}`,
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
            `Repeating invoice created: ${ri.repeatingInvoiceID}`,
            `Contact: ${ri.contact?.name}`,
            `Type: ${ri.type}`,
            `Status: ${ri.status}`,
            sched
              ? `Schedule: every ${sched.period} ${sched.unit}, due ${sched.dueDate} ${sched.dueDateType}`
              : null,
            sched?.nextScheduledDate ? `Next: ${sched.nextScheduledDate}` : null,
            ri.total !== undefined ? `Total: ${ri.total}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default CreateRepeatingInvoiceTool;
