import { PurchaseOrder } from "xero-node";
import { formatLineItem } from "./format-line-item.js";

export const formatPurchaseOrder = (
  purchaseOrder: PurchaseOrder,
  options?: { includeLineItems?: boolean },
): string => {
  return [
    `ID: ${purchaseOrder.purchaseOrderID}`,
    purchaseOrder.purchaseOrderNumber
      ? `Number: ${purchaseOrder.purchaseOrderNumber}`
      : null,
    purchaseOrder.reference ? `Reference: ${purchaseOrder.reference}` : null,
    `Status: ${purchaseOrder.status || "Unknown"}`,
    purchaseOrder.contact
      ? `Contact: ${purchaseOrder.contact.name} (${purchaseOrder.contact.contactID})`
      : null,
    purchaseOrder.date ? `Date: ${purchaseOrder.date}` : null,
    purchaseOrder.deliveryDate
      ? `Delivery Date: ${purchaseOrder.deliveryDate}`
      : null,
    purchaseOrder.deliveryAddress
      ? `Delivery Address: ${purchaseOrder.deliveryAddress}`
      : null,
    purchaseOrder.attentionTo
      ? `Attention To: ${purchaseOrder.attentionTo}`
      : null,
    purchaseOrder.telephone ? `Telephone: ${purchaseOrder.telephone}` : null,
    purchaseOrder.deliveryInstructions
      ? `Delivery Instructions: ${purchaseOrder.deliveryInstructions}`
      : null,
    purchaseOrder.lineAmountTypes
      ? `Line Amount Types: ${purchaseOrder.lineAmountTypes}`
      : null,
    purchaseOrder.subTotal != null
      ? `Sub Total: ${purchaseOrder.subTotal}`
      : null,
    purchaseOrder.totalTax != null
      ? `Total Tax: ${purchaseOrder.totalTax}`
      : null,
    `Total: ${purchaseOrder.total || 0}`,
    purchaseOrder.currencyCode
      ? `Currency: ${purchaseOrder.currencyCode}`
      : null,
    purchaseOrder.updatedDateUTC
      ? `Last Updated: ${purchaseOrder.updatedDateUTC}`
      : null,
    options?.includeLineItems
      ? `Line Items:\n${purchaseOrder.lineItems?.map(formatLineItem).join("\n---\n") || "None"}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
};
