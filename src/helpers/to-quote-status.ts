import { QuoteStatusCodes } from "xero-node";

/**
 * Quote statuses a caller is allowed to set.
 *
 * INVOICED and DELETED are deliberately excluded. A quote only reaches
 * INVOICED by having an invoice created from it, and DELETED is a separate
 * destructive operation — neither belongs behind a status field on an update.
 */
export const settableQuoteStatusNames = [
  "DRAFT",
  "SENT",
  "DECLINED",
  "ACCEPTED",
] as const;

export type SettableQuoteStatusName =
  (typeof settableQuoteStatusNames)[number];

export function toQuoteStatus(
  name: SettableQuoteStatusName | undefined,
): QuoteStatusCodes | undefined {
  switch (name) {
    case "DRAFT":
      return QuoteStatusCodes.DRAFT;
    case "SENT":
      return QuoteStatusCodes.SENT;
    case "DECLINED":
      return QuoteStatusCodes.DECLINED;
    case "ACCEPTED":
      return QuoteStatusCodes.ACCEPTED;
    default:
      return undefined;
  }
}
