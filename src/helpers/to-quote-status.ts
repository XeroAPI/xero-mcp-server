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

/**
 * Status transitions Xero rejects, verified against a live organisation.
 *
 * Xero refuses these with a generic error carrying no explanation, so they are
 * caught before the request is sent and reported with the route that does
 * work. Only transitions confirmed to fail are listed: every other combination
 * is passed through to Xero rather than guessed at, so a legal transition is
 * never blocked by an assumption made here.
 */
export const rejectedQuoteTransitions: ReadonlyArray<{
  from: QuoteStatusCodes;
  to: QuoteStatusCodes;
}> = [
  { from: QuoteStatusCodes.DRAFT, to: QuoteStatusCodes.DECLINED },
  { from: QuoteStatusCodes.ACCEPTED, to: QuoteStatusCodes.DECLINED },
];

/**
 * Returns an explanatory message when a transition is known to be rejected,
 * or null when it should be attempted.
 */
export function describeRejectedQuoteTransition(
  from: QuoteStatusCodes | undefined,
  to: QuoteStatusCodes | undefined,
): string | null {
  if (!from || !to) return null;

  const rejected = rejectedQuoteTransitions.some(
    (transition) => transition.from === from && transition.to === to,
  );

  if (!rejected) return null;

  return `Xero does not allow a quote to move directly from ${from} to ${to}. Set it to ${QuoteStatusCodes.SENT} first, then to ${to}.`;
}
