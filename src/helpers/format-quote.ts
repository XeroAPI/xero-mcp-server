import { LineItem, LineItemTracking, Quote } from "xero-node";

function formatTracking(tracking?: LineItemTracking[]): string | null {
  if (!tracking?.length) {
    return null;
  }

  const value = tracking
    .map((entry) => {
      const name = entry.name ?? "Unknown";
      const option = entry.option ?? "Unknown";
      return `${name}: ${option}`;
    })
    .join("; ");

  return `Tracking: ${value}`;
}

export function formatQuoteLineItem(
  lineItem: LineItem,
  index: number,
): string {
  return [
    `${index + 1}.`,
    lineItem.itemCode ? `Item Code: ${lineItem.itemCode}` : null,
    lineItem.description ? `Description: ${lineItem.description}` : null,
    lineItem.quantity !== undefined ? `Quantity: ${lineItem.quantity}` : null,
    lineItem.unitAmount !== undefined
      ? `Unit Amount: ${lineItem.unitAmount}`
      : null,
    lineItem.accountCode ? `Account Code: ${lineItem.accountCode}` : null,
    lineItem.taxType ? `Tax Type: ${lineItem.taxType}` : null,
    lineItem.lineAmount !== undefined
      ? `Line Amount: ${lineItem.lineAmount}`
      : null,
    lineItem.discountRate !== undefined
      ? `Discount Rate: ${lineItem.discountRate}`
      : null,
    lineItem.discountAmount !== undefined
      ? `Discount Amount: ${lineItem.discountAmount}`
      : null,
    formatTracking(lineItem.tracking),
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatQuoteLineItems(lineItems?: LineItem[]): string | null {
  if (!lineItems?.length) {
    return null;
  }

  return [
    `Line Items (${lineItems.length}):`,
    ...lineItems.map((lineItem, index) => formatQuoteLineItem(lineItem, index)),
  ].join("\n");
}

export function formatQuote(quote: Quote): string {
  return [
    `Quote ID: ${quote.quoteID}`,
    `Quote Number: ${quote.quoteNumber}`,
    quote.reference ? `Reference: ${quote.reference}` : null,
    `Status: ${quote.status || "Unknown"}`,
    quote.contact
      ? `Contact: ${quote.contact.name} (${quote.contact.contactID})`
      : null,
    quote.dateString ? `Quote Date: ${quote.dateString}` : null,
    quote.expiryDateString ? `Expiry Date: ${quote.expiryDateString}` : null,
    quote.title ? `Title: ${quote.title}` : null,
    quote.summary ? `Summary: ${quote.summary}` : null,
    quote.terms ? `Terms: ${quote.terms}` : null,
    quote.lineAmountTypes
      ? `Line Amount Types: ${quote.lineAmountTypes}`
      : null,
    quote.subTotal ? `Sub Total: ${quote.subTotal}` : null,
    quote.totalTax ? `Total Tax: ${quote.totalTax}` : null,
    `Total: ${quote.total || 0}`,
    quote.totalDiscount ? `Total Discount: ${quote.totalDiscount}` : null,
    quote.currencyCode ? `Currency: ${quote.currencyCode}` : null,
    quote.currencyRate ? `Currency Rate: ${quote.currencyRate}` : null,
    quote.updatedDateUTC ? `Last Updated: ${quote.updatedDateUTC}` : null,
    formatQuoteLineItems(quote.lineItems),
  ]
    .filter(Boolean)
    .join("\n");
}
