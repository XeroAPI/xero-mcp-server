import { LineItem } from "xero-node";

export const formatLineItem = (lineItem: LineItem): string => {
  const tracking = lineItem.tracking
    ?.map((entry) => {
      const category = entry.name ?? entry.trackingCategoryID;
      const option = entry.option ?? entry.trackingOptionID;

      if (category && option) {
        return `${category}=${option}`;
      }

      return category ?? option ?? null;
    })
    .filter((entry): entry is string => entry !== null);

  return [
    lineItem.lineItemID ? `Line Item ID: ${lineItem.lineItemID}` : null,
    lineItem.item?.itemID ? `Item ID: ${lineItem.item.itemID}` : null,
    lineItem.itemCode ? `Item Code: ${lineItem.itemCode}` : null,
    lineItem.description ? `Description: ${lineItem.description}` : null,
    lineItem.quantity !== undefined ? `Quantity: ${lineItem.quantity}` : null,
    lineItem.unitAmount !== undefined ? `Unit Amount: ${lineItem.unitAmount}` : null,
    lineItem.accountCode ? `Account Code: ${lineItem.accountCode}` : null,
    lineItem.taxType ? `Tax Type: ${lineItem.taxType}` : null,
    lineItem.taxAmount !== undefined ? `Tax Amount: ${lineItem.taxAmount}` : null,
    lineItem.discountRate !== undefined
      ? `Discount Rate: ${lineItem.discountRate}`
      : null,
    lineItem.discountAmount !== undefined
      ? `Discount Amount: ${lineItem.discountAmount}`
      : null,
    tracking?.length ? `Tracking: ${tracking.join(", ")}` : null,
    lineItem.lineAmount !== undefined ? `Line Amount: ${lineItem.lineAmount}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};
