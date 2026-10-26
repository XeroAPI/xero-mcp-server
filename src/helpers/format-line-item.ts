import { LineItem } from "xero-node";

export const formatLineItem = (lineItem: LineItem): string => {
  const tracking = lineItem.tracking
    ?.map((t) => `${t.name}: ${t.option}`)
    .join(", ");

  return [
    lineItem.item?.itemID ? `Item ID: ${lineItem.item.itemID}` : null,
    lineItem.itemCode ? `Item Code: ${lineItem.itemCode}` : null,
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
    tracking ? `Tracking: ${tracking}` : null,
    `Line Amount: ${lineItem.lineAmount}`,
  ]
    .filter(Boolean)
    .join("\n");
};
