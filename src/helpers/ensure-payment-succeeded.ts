import { Payment } from "xero-node";

export function ensurePaymentSucceeded(payment: Payment | undefined): Payment {
  if (!payment) {
    throw new Error("Payment creation failed.");
  }

  const validationErrors = payment.validationErrors ?? [];
  if (validationErrors.length) {
    const validationMessages = validationErrors
      .map((validationError) => validationError.message)
      .filter((message): message is string => Boolean(message));

    throw new Error(
      validationMessages.join("; ") || "Xero returned a validation error.",
    );
  }

  return payment;
}
