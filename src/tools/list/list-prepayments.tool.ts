import { z } from "zod";
import { listXeroPrepayments } from "../../handlers/list-xero-prepayments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListPrepaymentsTool = CreateXeroTool(
  "list-prepayments",
  `List prepayments in Xero. A prepayment is money received in advance of an invoice; its
  remaining balance can be allocated to an invoice with the create-prepayment-allocation
  tool. Optionally filter by contact. Ask the user if they want the next page after 10 are
  returned; if so, call again with the next page number.`,
  {
    page: z.number(),
    contactId: z.string().optional(),
    pageSize: z.number().min(1).max(100).default(10).optional().describe("Number of results per page (1-100, default 10)"),
  },
  async ({ page, contactId, pageSize }) => {
    const response = await listXeroPrepayments(page, contactId, pageSize);
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing prepayments: ${response.error}`,
          },
        ],
      };
    }

    const prepayments = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${prepayments?.length || 0} prepayments:`,
        },
        ...(prepayments?.map((prepayment) => ({
          type: "text" as const,
          text: [
            `Prepayment ID: ${prepayment.prepaymentID}`,
            `Type: ${prepayment.type || "Unknown"}`,
            `Status: ${prepayment.status || "Unknown"}`,
            prepayment.contact
              ? `Contact: ${prepayment.contact.name} (${prepayment.contact.contactID})`
              : null,
            prepayment.date ? `Date: ${prepayment.date}` : null,
            `Total: ${prepayment.total ?? 0}`,
            `Remaining Credit: ${prepayment.remainingCredit ?? 0}`,
            prepayment.currencyCode ? `Currency: ${prepayment.currencyCode}` : null,
            prepayment.updatedDateUTC ? `Last Updated: ${prepayment.updatedDateUTC}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPrepaymentsTool;
