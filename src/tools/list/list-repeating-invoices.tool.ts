import { z } from "zod";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { listXeroRepeatingInvoices } from "../../handlers/list-xero-repeating-invoices.handler.js";

const ListRepeatingInvoicesTool = CreateXeroTool(
  "list-repeating-invoices",
  "List repeating invoice templates in Xero. Returns active (DRAFT/AUTHORISED) and DELETED templates. \
Xero's API does not paginate this endpoint, so all matching templates are returned in one call. \
Use the optional `where` parameter to filter (e.g. Status==\"AUTHORISED\") and `order` to sort.",
  {
    where: z
      .string()
      .optional()
      .describe(
        "Optional Xero where-clause, e.g. 'Status==\"AUTHORISED\"' or 'Type==\"ACCREC\"'.",
      ),
    order: z
      .string()
      .optional()
      .describe("Optional Xero order clause, e.g. 'Schedule.NextScheduledDate ASC'."),
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

    const items = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${items?.length ?? 0} repeating invoice templates:`,
        },
        ...(items?.map((ri) => {
          const sched = ri.schedule;
          return {
            type: "text" as const,
            text: [
              `ID: ${ri.repeatingInvoiceID}`,
              `Contact: ${ri.contact?.name ?? "Unknown"}`,
              `Type: ${ri.type ?? "Unknown"}`,
              `Status: ${ri.status ?? "Unknown"}`,
              sched
                ? `Schedule: every ${sched.period} ${sched.unit ?? ""}, due ${sched.dueDate} ${sched.dueDateType ?? ""}`
                : null,
              sched?.nextScheduledDate ? `Next: ${sched.nextScheduledDate}` : null,
              sched?.endDate ? `Ends: ${sched.endDate}` : null,
              ri.reference ? `Reference: ${ri.reference}` : null,
              ri.currencyCode ? `Currency: ${ri.currencyCode}` : null,
              ri.total !== undefined ? `Total: ${ri.total}` : null,
              ri.approvedForSending ? "Approved for sending: yes" : null,
            ]
              .filter(Boolean)
              .join("\n"),
          };
        }) ?? []),
      ],
    };
  },
);

export default ListRepeatingInvoicesTool;
