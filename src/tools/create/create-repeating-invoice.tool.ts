import { z } from "zod";
import { createXeroRepeatingInvoice } from "../../handlers/create-xero-repeating-invoice.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatRepeatingInvoice } from "../../helpers/format-repeating-invoice.js";

const trackingSchema = z.object({
  name: z
    .string()
    .describe(
      "The name of the tracking category. Can be obtained from the list-tracking-categories tool",
    ),
  option: z
    .string()
    .describe(
      "The name of the tracking option. Can be obtained from the list-tracking-categories tool",
    ),
  trackingCategoryID: z
    .string()
    .describe(
      "The ID of the tracking category. Can be obtained from the list-tracking-categories tool",
    ),
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
  itemCode: z
    .string()
    .describe(
      "The item code of the line item - can be obtained from the list-items tool. \
If the item is not listed, add without an item code and ask the user if they would like to add an item code.",
    )
    .optional(),
  tracking: z
    .array(trackingSchema)
    .describe(
      "Up to 2 tracking categories and options can be added to the line item. \
Can be obtained from the list-tracking-categories tool. Only use if prompted by the user.",
    )
    .optional(),
});

const scheduleSchema = z.object({
  period: z
    .number()
    .int()
    .positive()
    .describe(
      "How often the invoice repeats, used with unit. 1 means every week or month.",
    ),
  unit: z
    .enum(["WEEKLY", "MONTHLY"])
    .describe("The schedule unit. WEEKLY or MONTHLY."),
  dueDate: z
    .number()
    .int()
    .describe(
      "Integer used with dueDateType, for example 10 with OFFOLLOWINGMONTH means the 10th of the following month.",
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
    .describe("How the due date is calculated from each generated invoice."),
  startDate: z
    .string()
    .describe("The first invoice date for this schedule (YYYY-MM-DD)."),
  endDate: z
    .string()
    .optional()
    .describe("Optional last invoice date for this schedule (YYYY-MM-DD)."),
});

const CreateRepeatingInvoiceTool = CreateXeroTool(
  "create-repeating-invoice",
  "Create a repeating invoice template in Xero. \
Creates as DRAFT unless status AUTHORISED is supplied. \
AUTHORISED templates start generating invoices on the schedule. \
ACCREC is a sales invoice; ACCPAY is a bill.",
  {
    contactId: z
      .string()
      .describe(
        "The ID of the contact to create the repeating invoice for. \
Can be obtained from the list-contacts tool.",
      ),
    lineItems: z.array(lineItemSchema),
    schedule: scheduleSchema,
    type: z
      .enum(["ACCREC", "ACCPAY"])
      .optional()
      .describe(
        "ACCREC is sales invoices / accounts receivable. ACCPAY is bills / accounts payable. Defaults to ACCREC.",
      ),
    reference: z
      .string()
      .optional()
      .describe("ACCREC only – additional reference number."),
    status: z
      .enum(["DRAFT", "AUTHORISED"])
      .optional()
      .describe(
        "DRAFT (default) does not generate invoices. AUTHORISED starts generating invoices on the schedule.",
      ),
    lineAmountTypes: z
      .enum(["Exclusive", "Inclusive", "NoTax"])
      .optional()
      .describe("How tax is applied to line amounts. Defaults to Exclusive."),
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

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Repeating invoice created successfully:",
            formatRepeatingInvoice(result.result, { includeLineItems: true }),
          ].join("\n"),
        },
      ],
    };
  },
);

export default CreateRepeatingInvoiceTool;
