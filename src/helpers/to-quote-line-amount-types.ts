import { QuoteLineAmountTypes } from "xero-node";

/**
 * Tool-facing names for a quote's line amount types.
 *
 * These match the vocabulary already used by the manual journal tools, which is
 * why NO_TAX is spelled with an underscore here while the value Xero expects on
 * a quote is NOTAX. Mapping explicitly keeps the two apart — note also that
 * quotes use QuoteLineAmountTypes rather than the LineAmountTypes enum used by
 * invoices and manual journals, and the two do not share the same values.
 */
export const quoteLineAmountTypeNames = [
  "EXCLUSIVE",
  "INCLUSIVE",
  "NO_TAX",
] as const;

export type QuoteLineAmountTypeName = (typeof quoteLineAmountTypeNames)[number];

export function toQuoteLineAmountTypes(
  name: QuoteLineAmountTypeName | undefined,
): QuoteLineAmountTypes | undefined {
  switch (name) {
    case "EXCLUSIVE":
      return QuoteLineAmountTypes.EXCLUSIVE;
    case "INCLUSIVE":
      return QuoteLineAmountTypes.INCLUSIVE;
    case "NO_TAX":
      return QuoteLineAmountTypes.NOTAX;
    default:
      return undefined;
  }
}
