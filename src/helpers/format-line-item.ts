import { LineItem } from "xero-node";

const formatTracking = (tracking: LineItem["tracking"]): string | undefined => {
  if (!tracking?.length) {
    return undefined;
  }

  return tracking
    .map((trackingItem) =>
      [
        trackingItem.name ? `Category: ${trackingItem.name}` : undefined,
        trackingItem.trackingCategoryID
          ? `Category ID: ${trackingItem.trackingCategoryID}`
          : undefined,
        trackingItem.option ? `Option: ${trackingItem.option}` : undefined,
        trackingItem.trackingOptionID
          ? `Option ID: ${trackingItem.trackingOptionID}`
          : undefined,
      ]
        .filter(Boolean)
        .join(", "),
    )
    .filter(Boolean)
    .join("; ");
};

export const formatLineItem = (lineItem: LineItem): string => {
  const tracking = formatTracking(lineItem.tracking);

  return [
    `Item ID: ${lineItem.item}`,
    `Item Code: ${lineItem.itemCode}`,
    `Description: ${lineItem.description}`,
    `Quantity: ${lineItem.quantity}`,
    `Unit Amount: ${lineItem.unitAmount}`,
    `Account Code: ${lineItem.accountCode}`,
    `Tax Type: ${lineItem.taxType}`,
    tracking ? `Tracking: ${tracking}` : undefined,
    `Line Amount: ${lineItem.lineAmount}`,
  ]
    .filter(Boolean)
    .join("\n");
};
