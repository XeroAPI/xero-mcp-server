import { LineItem } from "xero-node";

export const formatLineItem = (lineItem: LineItem): string => {
  return [
    lineItem.lineItemID ? `Line Item ID: ${lineItem.lineItemID}` : null,
    `Item ID: ${lineItem.item}`,
    `Item Code: ${lineItem.itemCode}`,
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
    `Tracking: ${lineItem.tracking}`,
    lineItem.discountRate !== undefined ? `Discount Rate: ${lineItem.discountRate}` : null,
    lineItem.discountAmount !== undefined ? `Discount Amount: ${lineItem.discountAmount}` : null,
    `Line Amount: ${lineItem.lineAmount}`,
  ]
    .filter(Boolean)
    .join("\n");
};
