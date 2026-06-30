import { LineItem } from "xero-node";

function formatTracking(lineItem: LineItem): string {
  if (lineItem.tracking == null || lineItem.tracking.length === 0) {
    return "";
  }

  return lineItem.tracking
    .map((tracking) => {
      const label = [tracking.name, tracking.option].filter(Boolean).join(": ");

      return label || tracking.trackingCategoryID || JSON.stringify(tracking);
    })
    .join(", ");
}

export const formatLineItem = (lineItem: LineItem): string => {
  return [
    `Item ID: ${lineItem.item}`,
    `Item Code: ${lineItem.itemCode}`,
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
    `Tracking: ${formatTracking(lineItem)}`,
    `Line Amount: ${lineItem.lineAmount}`,
  ].join("\n");
};
