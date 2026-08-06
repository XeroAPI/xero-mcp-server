import { z } from "zod";
import { listXeroRepeatingInvoices } from "../../handlers/list-xero-repeating-invoices.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListRepeatingInvoicesTool = CreateXeroTool(
  "list-repeating-invoices",
  `List repeating-invoice templates in Xero.
  Repeating invoices are templates Xero uses to auto-generate invoices on a schedule.
  Optionally filter with a 'where' clause or sort with 'order'.
  Common 'where' patterns: Type=="ACCREC" (sales templates), Type=="ACCPAY" (bill templates),
  Status=="AUTHORISED", Contact.Name=="ABC Ltd". Range operators: >, >=, <, <=. Logical: AND, OR.
  To read a single template in full (including line items), use the get-repeating-invoice tool.`,
  {
    where: z
      .string()
      .optional()
      .describe(
        'Filter clause, e.g. Type=="ACCREC", Status=="AUTHORISED", Contact.Name=="ABC Ltd".',
      ),
    order: z
      .string()
      .optional()
      .describe("Order by field, e.g. 'Type', 'Status'."),
  },
  async ({ where, order }) => {
    const response = await listXeroRepeatingInvoices(where, order);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing repeating invoices: ${response.error}`,
          },
        ],
      };
    }

    const repeatingInvoices = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${repeatingInvoices?.length || 0} repeating invoices:`,
        },
        ...(repeatingInvoices?.map((ri) => ({
          type: "text" as const,
          text: [
            `Repeating Invoice ID: ${ri.repeatingInvoiceID}`,
            `Type: ${ri.type || "Unknown"}`,
            `Status: ${ri.status || "Unknown"}`,
            ri.contact
              ? `Contact: ${ri.contact.name} (${ri.contact.contactID})`
              : null,
            ri.reference ? `Reference: ${ri.reference}` : null,
            ri.schedule
              ? `Schedule: every ${ri.schedule.period} ${ri.schedule.unit}`
              : null,
            ri.schedule?.startDate ? `Start Date: ${ri.schedule.startDate}` : null,
            ri.schedule?.nextScheduledDate
              ? `Next Scheduled: ${ri.schedule.nextScheduledDate}`
              : null,
            ri.schedule?.endDate ? `End Date: ${ri.schedule.endDate}` : null,
            ri.currencyCode ? `Currency: ${ri.currencyCode}` : null,
            ri.total != null ? `Total: ${ri.total}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListRepeatingInvoicesTool;
