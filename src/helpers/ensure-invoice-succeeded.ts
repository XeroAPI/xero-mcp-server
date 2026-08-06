import { Invoice } from "xero-node";

export function ensureInvoiceSucceeded(
  invoice: Invoice | undefined,
  operation: "creation" | "update",
): Invoice {
  if (!invoice) {
    throw new Error(`Invoice ${operation} failed.`);
  }

  const validationErrors = invoice.validationErrors ?? [];
  if (invoice.hasErrors || validationErrors.length) {
    const validationMessages = validationErrors
      .map((validationError) => validationError.message)
      .filter((message): message is string => Boolean(message));

    throw new Error(
      validationMessages.join("; ") || "Xero returned a validation error.",
    );
  }

  return invoice;
}
