import { ManualJournal } from "xero-node";

export function ensureManualJournalSucceeded(
  manualJournal: ManualJournal | undefined,
  operation: "creation" | "update",
): ManualJournal {
  if (!manualJournal) {
    throw new Error(`Manual journal ${operation} failed.`);
  }

  const validationErrors = manualJournal.validationErrors ?? [];

  if (validationErrors.length) {
    const validationMessages = validationErrors
      .map((validationError) => validationError.message)
      .filter((message): message is string => Boolean(message));

    throw new Error(
      validationMessages.join("; ") || "Xero returned a validation error.",
    );
  }

  return manualJournal;
}
