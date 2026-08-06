import { ManualJournal } from "xero-node";

export function ensureManualJournalSucceeded(
  manualJournal: ManualJournal | undefined,
  operation: "creation" | "update",
): ManualJournal {
  if (!manualJournal) {
    throw new Error(`Manual journal ${operation} failed.`);
  }

  const validationMessages = manualJournal.validationErrors
    ?.map((validationError) => validationError.message)
    .filter((message): message is string => Boolean(message));

  if (validationMessages?.length) {
    throw new Error(validationMessages.join("; "));
  }

  return manualJournal;
}
