import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { getXeroRepeatingInvoice } from "../../handlers/get-xero-repeating-invoice.handler.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const GetRepeatingInvoiceTool = CreateXeroTool(
  "get-repeating-invoice",
  `Get a single repeating-invoice template in Xero by ID, including its line items and schedule.
  Use this to read a template in full before updating it (update replaces the whole template).`,
  {
    repeatingInvoiceId: z
      .string()
      .describe("The Xero Repeating Invoice ID (UUID). Can be obtained from list-repeating-invoices."),
  },
  async ({ repeatingInvoiceId }) => {
    const response = await getXeroRepeatingInvoice(repeatingInvoiceId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting repeating invoice: ${response.error}`,
          },
        ],
      };
    }

    const ri = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Repeating Invoice ID: ${ri?.repeatingInvoiceID}`,
            `Type: ${ri?.type || "Unknown"}`,
            `Status: ${ri?.status || "Unknown"}`,
            ri?.contact
              ? `Contact: ${ri.contact.name} (${ri.contact.contactID})`
              : null,
            ri?.reference ? `Reference: ${ri.reference}` : null,
            ri?.schedule
              ? `Schedule: every ${ri.schedule.period} ${ri.schedule.unit}`
              : null,
            ri?.schedule?.startDate ? `Start Date: ${ri.schedule.startDate}` : null,
            ri?.schedule?.dueDate != null
              ? `Due Date: ${ri.schedule.dueDate} (${ri.schedule.dueDateType})`
              : null,
            ri?.schedule?.nextScheduledDate
              ? `Next Scheduled: ${ri.schedule.nextScheduledDate}`
              : null,
            ri?.schedule?.endDate ? `End Date: ${ri.schedule.endDate}` : null,
            ri?.lineAmountTypes ? `Line Amount Types: ${ri.lineAmountTypes}` : null,
            ri?.currencyCode ? `Currency: ${ri.currencyCode}` : null,
            ri?.total != null ? `Total: ${ri.total}` : null,
            ri?.lineItems?.length
              ? `Line Items:\n${ri.lineItems.map(formatLineItem).join("\n---\n")}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default GetRepeatingInvoiceTool;
