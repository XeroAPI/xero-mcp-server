import { z } from "zod";
import { listXeroPurchaseOrders } from "../../handlers/list-xero-purchase-orders.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatLineItem } from "../../helpers/format-line-item.js";
import { PurchaseOrder } from "xero-node";

const ListPurchaseOrdersTool = CreateXeroTool(
  "list-purchase-orders",
  "List purchase orders in Xero. This includes Draft, Submitted, Authorised, and Billed purchase orders. \
  Ask the user if they want to filter by status or date range before running. \
  Ask the user if they want the next page of purchase orders after running this tool \
  if 10 purchase orders are returned. \
  If they want the next page, call this tool again with the next page number \
  and the same filters if any were provided in the previous call.",
  {
    page: z.number().describe("The page number to retrieve (starts at 1)."),
    status: z.enum(["DRAFT", "SUBMITTED", "AUTHORISED", "BILLED", "DELETED"])
      .describe("Filter by purchase order status.").optional(),
    dateFrom: z.string().describe("Filter by purchase orders on or after this date (YYYY-MM-DD format).").optional(),
    dateTo: z.string().describe("Filter by purchase orders on or before this date (YYYY-MM-DD format).").optional(),
  },
  async ({ page, status, dateFrom, dateTo }) => {
    const statusEnum = status ? PurchaseOrder.StatusEnum[status as keyof typeof PurchaseOrder.StatusEnum] : undefined;

    const response = await listXeroPurchaseOrders(page, statusEnum, dateFrom, dateTo);

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
        ...(purchaseOrders?.map((po) => ({
          type: "text" as const,
          text: [
            `Purchase Order ID: ${po.purchaseOrderID}`,
            `Number: ${po.purchaseOrderNumber}`,
            po.reference ? `Reference: ${po.reference}` : null,
            `Status: ${po.status || "Unknown"}`,
            po.contact
              ? `Contact: ${po.contact.name} (${po.contact.contactID})`
              : null,
            po.date ? `Date: ${po.date}` : null,
            po.deliveryDate ? `Delivery Date: ${po.deliveryDate}` : null,
            po.deliveryAddress ? `Delivery Address: ${po.deliveryAddress}` : null,
            po.attentionTo ? `Attention To: ${po.attentionTo}` : null,
            po.lineAmountTypes
              ? `Line Amount Types: ${po.lineAmountTypes}`
              : null,
            po.subTotal !== undefined ? `Sub Total: ${po.subTotal}` : null,
            po.totalTax !== undefined ? `Total Tax: ${po.totalTax}` : null,
            `Total: ${po.total || 0}`,
            po.totalDiscount
              ? `Total Discount: ${po.totalDiscount}`
              : null,
            po.currencyCode ? `Currency: ${po.currencyCode}` : null,
            po.currencyRate
              ? `Currency Rate: ${po.currencyRate}`
              : null,
            po.updatedDateUTC
              ? `Last Updated: ${po.updatedDateUTC}`
              : null,
            po.sentToContact ? "Sent to Contact: Yes" : null,
            po.hasAttachments ? "Has Attachments: Yes" : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPurchaseOrdersTool;
