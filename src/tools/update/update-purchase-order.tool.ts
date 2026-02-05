import { z } from "zod";
import { updateXeroPurchaseOrder } from "../../handlers/update-xero-purchase-order.handler.js";
import { DeepLinkType, getDeepLink } from "../../helpers/get-deeplink.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { PurchaseOrder } from "xero-node";

const trackingSchema = z.object({
  name: z.string().describe("The name of the tracking category. Can be obtained from the list-tracking-categories tool"),
  option: z.string().describe("The name of the tracking option. Can be obtained from the list-tracking-categories tool"),
  trackingCategoryID: z.string().describe("The ID of the tracking category. \
    Can be obtained from the list-tracking-categories tool"),
});

const lineItemSchema = z.object({
  lineItemID: z.string().describe("The ID of an existing line item to update. \
    Required when updating existing line items.").optional(),
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z.string().describe("The account code of the line item - can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type of the line item - can be obtained from the list-tax-rates tool"),
  itemCode: z.string().describe("The item code of the line item - can be obtained from the list-items tool.").optional(),
  tracking: z.array(trackingSchema).describe("Up to 2 tracking categories and options can be added to the line item. \
    Can be obtained from the list-tracking-categories tool. \
    Only use if prompted by the user.").optional(),
});

const UpdatePurchaseOrderTool = CreateXeroTool(
  "update-purchase-order",
  "Update an existing purchase order in Xero. Only works on draft purchase orders. \
  All line items must be provided when updating. Any line items not provided will be removed. \
  Do not modify line items that have not been specified by the user. \
  When a purchase order is updated, a deep link to the purchase order in Xero is returned. \
  This deep link can be used to view the purchase order in Xero directly. \
  This link should be displayed to the user.",
  {
    purchaseOrderId: z.string().describe("The unique ID of the purchase order to update."),
    contactId: z.string().describe("The ID of the contact (supplier) for the purchase order. \
      Can be obtained from the list-contacts tool.").optional(),
    lineItems: z.array(lineItemSchema).describe("All line items for the purchase order. \
      Any existing line items not included will be removed.").optional(),
    date: z.string().describe("The date the purchase order was issued (YYYY-MM-DD format).").optional(),
    deliveryDate: z.string().describe("The date the goods are to be delivered (YYYY-MM-DD format).").optional(),
    reference: z.string().describe("An additional reference number for the purchase order.").optional(),
    deliveryAddress: z.string().describe("The address the goods are to be delivered to.").optional(),
    attentionTo: z.string().describe("The person that the delivery is going to.").optional(),
    telephone: z.string().describe("The phone number for the person accepting the delivery.").optional(),
    deliveryInstructions: z.string().describe("Instructions for delivery (500 characters max).").optional(),
    status: z.enum(["DRAFT", "SUBMITTED", "AUTHORISED", "BILLED", "DELETED"])
      .describe("The status to set for the purchase order.").optional(),
  },
  async ({ purchaseOrderId, contactId, lineItems, date, deliveryDate, reference, deliveryAddress, attentionTo, telephone, deliveryInstructions, status }) => {
    const statusEnum = status ? PurchaseOrder.StatusEnum[status as keyof typeof PurchaseOrder.StatusEnum] : undefined;

    const result = await updateXeroPurchaseOrder(
      purchaseOrderId,
      contactId,
      lineItems,
      date,
      deliveryDate,
      reference,
      deliveryAddress,
      attentionTo,
      telephone,
      deliveryInstructions,
      statusEnum,
    );

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
      ? await getDeepLink(DeepLinkType.PURCHASE_ORDER, purchaseOrder.purchaseOrderID)
      : null;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Purchase order updated successfully:",
            `ID: ${purchaseOrder?.purchaseOrderID}`,
            `Number: ${purchaseOrder?.purchaseOrderNumber}`,
            `Contact: ${purchaseOrder?.contact?.name}`,
            `Date: ${purchaseOrder?.date}`,
            purchaseOrder?.deliveryDate ? `Delivery Date: ${purchaseOrder.deliveryDate}` : null,
            `Total: ${purchaseOrder?.total}`,
            `Status: ${purchaseOrder?.status}`,
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
