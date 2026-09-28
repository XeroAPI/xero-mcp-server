import { z } from "zod";
import { listXeroRepeatingInvoices } from "../../handlers/list-xero-repeating-invoices.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatRepeatingInvoice } from "../../helpers/format-repeating-invoice.js";

const ListRepeatingInvoicesTool = CreateXeroTool(
  "list-repeating-invoices",
  `List repeating invoice templates in Xero.
  Ask the user if they want to filter by contact, status, or type (sales invoices vs bills) before running.
  Ask the user if they want the next page after running this tool if 10 repeating invoices are returned.
  If they do, call this tool again with the next page number and the same filters.
  The Xero Repeating Invoices endpoint is not server-paginated; this tool returns 10 templates per page.`,
  {
    page: z
      .number()
      .describe("The page of repeating invoices to retrieve (10 per page)."),
    contactId: z
      .string()
      .optional()
      .describe(
        "Filter to repeating invoices for a specific contact. Can be obtained from the list-contacts tool.",
      ),
    status: z
      .enum(["DRAFT", "AUTHORISED", "DELETED"])
      .optional()
      .describe("Filter by repeating invoice status."),
    type: z
      .enum(["ACCREC", "ACCPAY"])
      .optional()
      .describe(
        "ACCREC is sales invoices / accounts receivable. ACCPAY is bills / accounts payable.",
      ),
  },
  async ({ page, contactId, status, type }) => {
    const response = await listXeroRepeatingInvoices({
      page,
      contactId,
      status,
      type,
    });
    if (response.error !== null) {
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
        ...(repeatingInvoices?.map((repeatingInvoice) => ({
          type: "text" as const,
          text: formatRepeatingInvoice(repeatingInvoice),
        })) || []),
      ],
    };
  },
);

export default ListRepeatingInvoicesTool;
