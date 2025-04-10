import { LineItem } from "xero-node";

export const formatLineItem = (lineItem: LineItem): string => {
  return [
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
  ].join("\n");
};
