import { BankTransaction } from "xero-node";

export function ensureBankTransactionSucceeded(
  bankTransaction: BankTransaction | undefined,
  operation: "creation" | "update",
): BankTransaction {
  if (!bankTransaction) {
    throw new Error(`Bank transaction ${operation} failed.`);
  }

  const validationErrors = bankTransaction.validationErrors ?? [];
  if (validationErrors.length) {
    const validationMessages = validationErrors
      .map((validationError) => validationError.message)
      .filter((message): message is string => Boolean(message));

    throw new Error(
      validationMessages.join("; ") || "Xero returned a validation error.",
    );
  }

  return bankTransaction;
}
