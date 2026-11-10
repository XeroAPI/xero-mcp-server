import { LineAmountTypes } from "xero-node";

/**
 * Friendly line-amount-type values exposed on the MCP tool schemas.
 *
 * These are the upper-snake-case names a caller passes to the manual journal
 * tools. They are NOT the values the Xero API expects.
 */
export type LineAmountTypeInput = "EXCLUSIVE" | "INCLUSIVE" | "NO_TAX";

/**
 * Map a friendly tool input value to the Xero SDK `LineAmountTypes` enum.
 *
 * The Xero API only accepts `Exclusive` / `Inclusive` / `NoTax`. Passing the
 * raw tool strings (`EXCLUSIVE` / `INCLUSIVE` / `NO_TAX`) straight through —
 * which a `as LineAmountTypes` cast silently allowed — sends an invalid value
 * and Xero rejects the whole request. This translates them correctly.
 *
 * @returns the matching `LineAmountTypes`, or `undefined` when no value was
 * supplied (Xero then defaults the journal to `NoTax`).
 */
export const mapLineAmountType = (
  input?: LineAmountTypeInput,
): LineAmountTypes | undefined => {
  switch (input) {
    case "EXCLUSIVE":
      return LineAmountTypes.Exclusive;
    case "INCLUSIVE":
      return LineAmountTypes.Inclusive;
    case "NO_TAX":
      return LineAmountTypes.NoTax;
    default:
      return undefined;
  }
};
