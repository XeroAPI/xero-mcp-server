import { LineItem } from "xero-node";

const field = (label: string, value: unknown): string | null =>
  value !== undefined && value !== null && value !== ""
    ? `${label}: ${value}`
    : null;

export const formatLineItem = (lineItem: LineItem): string => {
  const tracking = lineItem.tracking
    ?.map((t) => `${t.name}: ${t.option}`)
    .join(", ");

  return [
    field("Item ID", lineItem.item?.itemID),
    field("Item Code", lineItem.itemCode),
    field("Description", lineItem.description),
    field("Quantity", lineItem.quantity),
    field("Unit Amount", lineItem.unitAmount),
    field("Account Code", lineItem.accountCode),
    field("Tax Type", lineItem.taxType),
    field("Tracking", tracking),
    field("Line Amount", lineItem.lineAmount),
  ]
    .filter(Boolean)
    .join("\n");
};

export const formatLineItems = (lineItems?: LineItem[]): string =>
  lineItems?.length
    ? `Line Items:\n${lineItems.map(formatLineItem).join("\n\n")}`
    : "Line Items: none";
