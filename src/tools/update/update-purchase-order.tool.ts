import { z } from "zod";
import { updateXeroPurchaseOrder } from "../../handlers/update-xero-purchase-order.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatPurchaseOrder } from "../../helpers/format-purchase-order.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";

const trackingSchema = z.object({
  name: z
    .string()
    .describe(
      "The name of the tracking category. Can be obtained from the list-tracking-categories tool",
    ),
  option: z
    .string()
    .describe(
      "The name of the tracking option. Can be obtained from the list-tracking-categories tool",
    ),
  trackingCategoryID: z
    .string()
    .describe(
      "The ID of the tracking category. Can be obtained from the list-tracking-categories tool",
    ),
});

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z
    .string()
    .describe(
      "The account code of the line item - can be obtained from the list-accounts tool",
    ),
  taxType: z
    .string()
    .describe(
      "The tax type of the line item - can be obtained from the list-tax-rates tool",
    ),
  itemCode: z
    .string()
    .describe(
      "The item code of the line item - can be obtained from the list-items tool. \
If the item is not listed, add without an item code and ask the user if they would like to add an item code.",
    )
    .optional(),
  tracking: z
    .array(trackingSchema)
    .describe(
      "Up to 2 tracking categories and options can be added to the line item. \
Can be obtained from the list-tracking-categories tool. Only use if prompted by the user.",
    )
    .optional(),
});

const UpdatePurchaseOrderTool = CreateXeroTool(
  "update-purchase-order",
  "Update a purchase order in Xero. Only works on DRAFT and SUBMITTED purchase orders. \
  All line items must be provided when changing lines. Any line items not provided will be removed. \
  Do not modify line items that have not been specified by the user. \
  Use status AUTHORISED to approve a purchase order. \
  When a purchase order is updated, a deep link to the purchase order in Xero is returned. \
  This link should be displayed to the user.",
  {
    purchaseOrderId: z
      .string()
      .describe("The ID of the purchase order to update."),
    lineItems: z
      .array(lineItemSchema)
      .optional()
      .describe(
        "All line items must be provided. Any line items not provided will be removed. \
Do not modify line items that have not been specified by the user.",
      ),
    date: z
      .string()
      .optional()
      .describe("The date the purchase order was issued (YYYY-MM-DD)."),
    deliveryDate: z
      .string()
      .optional()
      .describe("The date the goods are to be delivered (YYYY-MM-DD)."),
    reference: z.string().optional(),
    purchaseOrderNumber: z.string().optional(),
    deliveryAddress: z.string().optional(),
    attentionTo: z.string().optional(),
    telephone: z.string().optional(),
    deliveryInstructions: z.string().optional(),
    contactId: z
      .string()
      .optional()
      .describe("Replace the supplier contact on the purchase order."),
    status: z
      .enum(["DRAFT", "SUBMITTED", "AUTHORISED"])
      .optional()
      .describe(
        "New status. AUTHORISED approves the purchase order.",
      ),
  },
  async (params) => {
    const result = await updateXeroPurchaseOrder(params);
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating purchase order: ${result.error}`,
          },
        ],
      };
    }

    const purchaseOrder = result.result;
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
            "Purchase order updated successfully:",
            formatPurchaseOrder(purchaseOrder),
            deepLink ? `Link to view: ${deepLink}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdatePurchaseOrderTool;
