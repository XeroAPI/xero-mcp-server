import { LineAmountTypes } from "xero-node";
import { RepeatingInvoiceLineAmountTypes } from "../types/repeating-invoice.js";

export function mapLineAmountTypes(
  lineAmountTypes?: RepeatingInvoiceLineAmountTypes,
): LineAmountTypes | undefined {
  switch (lineAmountTypes) {
    case "Inclusive":
      return LineAmountTypes.Inclusive;
    case "NoTax":
      return LineAmountTypes.NoTax;
    case "Exclusive":
      return LineAmountTypes.Exclusive;
    default:
      return undefined;
  }
}
