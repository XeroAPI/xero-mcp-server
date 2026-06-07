import { z } from "zod";
import { listXeroOverpayments } from "../../handlers/list-xero-overpayments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListOverpaymentsTool = CreateXeroTool(
  "list-overpayments",
  `List overpayments in Xero. An overpayment is money a contact paid in excess of what
  they owed; its remaining balance can be allocated to an invoice with the
  create-overpayment-allocation tool. Optionally filter by contact. Ask the user if they
  want the next page after 10 are returned; if so, call again with the next page number.`,
  {
    page: z.number(),
    contactId: z.string().optional(),
    pageSize: z.number().min(1).max(100).default(10).optional().describe("Number of results per page (1-100, default 10)"),
  },
  async ({ page, contactId, pageSize }) => {
    const response = await listXeroOverpayments(page, contactId, pageSize);
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing overpayments: ${response.error}`,
          },
        ],
      };
    }

    const overpayments = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${overpayments?.length || 0} overpayments:`,
        },
        ...(overpayments?.map((overpayment) => ({
          type: "text" as const,
          text: [
            `Overpayment ID: ${overpayment.overpaymentID}`,
            `Type: ${overpayment.type || "Unknown"}`,
            `Status: ${overpayment.status || "Unknown"}`,
            overpayment.contact
              ? `Contact: ${overpayment.contact.name} (${overpayment.contact.contactID})`
              : null,
            overpayment.date ? `Date: ${overpayment.date}` : null,
            `Total: ${overpayment.total ?? 0}`,
            `Remaining Credit: ${overpayment.remainingCredit ?? 0}`,
            overpayment.currencyCode ? `Currency: ${overpayment.currencyCode}` : null,
            overpayment.updatedDateUTC ? `Last Updated: ${overpayment.updatedDateUTC}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListOverpaymentsTool;
