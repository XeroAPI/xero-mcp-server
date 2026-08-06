import { CreditNote } from "xero-node";

export function ensureCreditNoteSucceeded(
  creditNote: CreditNote | null | undefined,
  operation: "creation" | "update",
): CreditNote {
  if (!creditNote) {
    throw new Error(`Credit note ${operation} failed.`);
  }

  const validationErrors = creditNote.validationErrors ?? [];
  if (creditNote.hasErrors || validationErrors.length > 0) {
    const validationMessages = validationErrors
      .map((validationError) => validationError.message)
      .filter((message): message is string => Boolean(message));

    throw new Error(
      validationMessages.join("; ") || "Xero returned a validation error.",
    );
  }

  return creditNote;
}
