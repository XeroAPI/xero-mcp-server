import { LineItem } from "xero-node";

export const formatLineItem = (lineItem: LineItem): string => {
  // `tracking` is a LineItemTracking[]; interpolating the array directly renders
  // "[object Object]" (gh-159). Render each category as "name: option" instead.
  const tracking =
    lineItem.tracking && lineItem.tracking.length > 0
      ? lineItem.tracking.map((t) => `${t.name}: ${t.option}`).join(", ")
      : "None";
  return [
    `Item ID: ${lineItem.item}`,
    `Item Code: ${lineItem.itemCode}`,
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
    `Tracking: ${tracking}`,
    `Line Amount: ${lineItem.lineAmount}`,
  ].join("\n");
};
