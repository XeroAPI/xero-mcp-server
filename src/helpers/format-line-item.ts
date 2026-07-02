import { LineItem } from "xero-node";

const formatTracking = (
  tracking: LineItem["tracking"],
): string =>
  (tracking ?? [])
    .map((t) => `${t.name}=${t.option}`)
    .join(", ");

export const formatLineItem = (lineItem: LineItem): string => {
  return [
    `Item ID: ${lineItem.item?.itemID ?? ""}`,
    `Item Code: ${lineItem.itemCode}`,
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
    `Tracking: ${formatTracking(lineItem.tracking)}`,
    `Line Amount: ${lineItem.lineAmount}`,
  ].join("\n");
};
