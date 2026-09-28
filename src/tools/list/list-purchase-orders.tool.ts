import { z } from "zod";
import { listXeroPurchaseOrders } from "../../handlers/list-xero-purchase-orders.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatPurchaseOrder } from "../../helpers/format-purchase-order.js";

const ListPurchaseOrdersTool = CreateXeroTool(
  "list-purchase-orders",
  `List purchase orders in Xero.
  Ask the user if they want to filter by status or date range before running.
  Ask the user if they want the next page of purchase orders after running this tool if 10 purchase orders are returned.
  If they do, call this tool again with the next page number and the same filters.`,
  {
    page: z.number().describe("The page of purchase orders to retrieve."),
    status: z
      .enum(["DRAFT", "SUBMITTED", "AUTHORISED", "BILLED", "DELETED"])
      .optional()
      .describe("Filter by purchase order status."),
    dateFrom: z
      .string()
      .optional()
      .describe("Filter purchase orders issued on or after this date (YYYY-MM-DD)."),
    dateTo: z
      .string()
      .optional()
      .describe("Filter purchase orders issued on or before this date (YYYY-MM-DD)."),
  },
  async ({ page, status, dateFrom, dateTo }) => {
    const response = await listXeroPurchaseOrders({
      page,
      status,
      dateFrom,
      dateTo,
    });
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing purchase orders: ${response.error}`,
          },
        ],
      };
    }

    const purchaseOrders = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${purchaseOrders?.length || 0} purchase orders:`,
        },
        ...(purchaseOrders?.map((purchaseOrder) => ({
          type: "text" as const,
          text: formatPurchaseOrder(purchaseOrder),
        })) || []),
      ],
    };
  },
);

export default ListPurchaseOrdersTool;
