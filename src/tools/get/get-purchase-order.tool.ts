import { z } from "zod";
import { getXeroPurchaseOrder } from "../../handlers/get-xero-purchase-order.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatLineItem } from "../../helpers/format-line-item.js";

const GetPurchaseOrderTool = CreateXeroTool(
  "get-purchase-order",
  "Get a single purchase order from Xero by its ID or purchase order number. \
  This returns full details including line items. \
  When a purchase order is retrieved, a deep link to the purchase order in Xero is returned. \
  This deep link can be used to view the purchase order in Xero directly. \
  This link should be displayed to the user.",
  {
    purchaseOrderId: z.string().describe("The unique ID of the purchase order.").optional(),
    purchaseOrderNumber: z.string().describe("The purchase order number.").optional(),
  },
  async ({ purchaseOrderId, purchaseOrderNumber }) => {
    if (!purchaseOrderId && !purchaseOrderNumber) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: Either purchaseOrderId or purchaseOrderNumber must be provided.",
          },
        ],
      };
    }

    const result = await getXeroPurchaseOrder(purchaseOrderId, purchaseOrderNumber);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting purchase order: ${result.error}`,
          },
        ],
      };
    }

    const po = result.result;

    const deepLink = po.purchaseOrderID
      ? await getDeepLink(DeepLinkType.PURCHASE_ORDER, po.purchaseOrderID)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Purchase Order Details:",
            `ID: ${po.purchaseOrderID}`,
            `Number: ${po.purchaseOrderNumber}`,
            po.reference ? `Reference: ${po.reference}` : null,
            `Status: ${po.status || "Unknown"}`,
            po.contact
              ? `Contact: ${po.contact.name} (${po.contact.contactID})`
              : null,
            po.date ? `Date: ${po.date}` : null,
            po.deliveryDate ? `Delivery Date: ${po.deliveryDate}` : null,
            po.expectedArrivalDate ? `Expected Arrival: ${po.expectedArrivalDate}` : null,
            po.deliveryAddress ? `Delivery Address: ${po.deliveryAddress}` : null,
            po.attentionTo ? `Attention To: ${po.attentionTo}` : null,
            po.telephone ? `Telephone: ${po.telephone}` : null,
            po.deliveryInstructions ? `Delivery Instructions: ${po.deliveryInstructions}` : null,
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
            po.brandingThemeID ? `Branding Theme ID: ${po.brandingThemeID}` : null,
            po.updatedDateUTC
              ? `Last Updated: ${po.updatedDateUTC}`
              : null,
            po.sentToContact ? "Sent to Contact: Yes" : null,
            po.hasAttachments ? "Has Attachments: Yes" : null,
            po.lineItems && po.lineItems.length > 0
              ? `Line Items:\n${po.lineItems.map(formatLineItem).join("\n")}`
              : null,
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default GetPurchaseOrderTool;
