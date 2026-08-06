import { Quote } from "xero-node";

export function ensureQuoteSucceeded(
  quote: Quote | undefined,
  operation: "creation" | "update",
): Quote {
  if (!quote) {
    throw new Error(`Quote ${operation} failed.`);
  }

  const validationErrors = quote.validationErrors ?? [];
  if (validationErrors.length > 0) {
    const validationMessages = validationErrors
      .map((validationError) => validationError.message)
      .filter((message): message is string => Boolean(message));

    throw new Error(
      validationMessages.join("; ") || "Xero returned a validation error.",
    );
  }

  return quote;
}
