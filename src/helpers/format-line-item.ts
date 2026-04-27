import { LineItem } from "xero-node";

export const formatLineItem = (lineItem: LineItem): string => {
  return [
    `Item: ${lineItem.item ? JSON.stringify(lineItem.item) : ""}`,
    `Item Code: ${lineItem.itemCode}`,
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
    `Tracking: ${lineItem.tracking && lineItem.tracking.length > 0 ? JSON.stringify(lineItem.tracking) : ""}`,
    `Line Amount: ${lineItem.lineAmount}`,
  ].join("\n");
};
