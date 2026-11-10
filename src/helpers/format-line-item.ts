import { LineItem } from "xero-node";

export const formatLineItem = (lineItem: LineItem): string => {
  return [
    `Item ID: ${lineItem.item}`,
    `Line Item ID: ${lineItem.lineItemID}`,
    `Item Code: ${lineItem.itemCode}`,
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
    `Tracking: ${lineItem.tracking}`,
    `Line Amount: ${lineItem.lineAmount}`,
  ].join("\n");
};
