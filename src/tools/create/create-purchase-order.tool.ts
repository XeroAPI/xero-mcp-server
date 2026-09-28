import { z } from "zod";
import { createXeroPurchaseOrder } from "../../handlers/create-xero-purchase-order.handler.js";
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

const CreatePurchaseOrderTool = CreateXeroTool(
  "create-purchase-order",
  "Create a draft purchase order in Xero. \
When a purchase order is created, a deep link to the purchase order in Xero is returned. \
This deep link can be used to view the purchase order in Xero directly. \
This link should be displayed to the user.",
  {
    contactId: z
      .string()
      .describe(
        "The ID of the supplier contact to create the purchase order for. \
Can be obtained from the list-contacts tool.",
      ),
    lineItems: z.array(lineItemSchema),
    date: z
      .string()
      .describe("The date the purchase order was issued (YYYY-MM-DD).")
      .optional(),
    deliveryDate: z
      .string()
      .describe("The date the goods are to be delivered (YYYY-MM-DD).")
      .optional(),
    reference: z
      .string()
      .describe("An additional reference number for the purchase order.")
      .optional(),
    purchaseOrderNumber: z
      .string()
      .describe(
        "A custom purchase order number. If omitted, Xero generates one from organisation invoice settings.",
      )
      .optional(),
    deliveryAddress: z
      .string()
      .describe("The address the goods are to be delivered to.")
      .optional(),
    attentionTo: z
      .string()
      .describe("The person that the delivery is going to.")
      .optional(),
    telephone: z
      .string()
      .describe("The phone number for the person accepting the delivery.")
      .optional(),
    deliveryInstructions: z
      .string()
      .describe("Free-text delivery instructions (500 characters max).")
      .optional(),
  },
  async (params) => {
    const result = await createXeroPurchaseOrder(params);
    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating purchase order: ${result.error}`,
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
            "Purchase order created successfully:",
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

export default CreatePurchaseOrderTool;
