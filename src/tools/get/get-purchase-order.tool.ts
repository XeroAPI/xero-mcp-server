import { z } from "zod";
import { getXeroPurchaseOrder } from "../../handlers/get-xero-purchase-order.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatPurchaseOrder } from "../../helpers/format-purchase-order.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const GetPurchaseOrderTool = CreateXeroTool(
  "get-purchase-order",
  `Retrieve a single purchase order from Xero by ID or purchase order number.
  Provide purchaseOrderId or purchaseOrderNumber. If both are provided, the ID is used.
  Line items and a deep link are included in the response.`,
  {
    purchaseOrderId: z
      .string()
      .optional()
      .describe("The ID of the purchase order to retrieve."),
    purchaseOrderNumber: z
      .string()
      .optional()
      .describe(
        "The purchase order number (for example PO-1001). Used when the ID is not available.",
      ),
  },
  async ({ purchaseOrderId, purchaseOrderNumber }) => {
    const response = await getXeroPurchaseOrder({
      purchaseOrderId,
      purchaseOrderNumber,
    });

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving purchase order: ${response.error}`,
          },
        ],
      };
    }

    const purchaseOrder = response.result;
    const deepLink = purchaseOrder.purchaseOrderID
      ? await getDeepLink(
          DeepLinkType.PURCHASE_ORDER,
          purchaseOrder.purchaseOrderID,
        )
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            formatPurchaseOrder(purchaseOrder, { includeLineItems: true }),
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
