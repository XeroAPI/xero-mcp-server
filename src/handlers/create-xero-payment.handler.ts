import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Payment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { ensurePaymentSucceeded } from "../helpers/ensure-payment-succeeded.js";

type PaymentProps = {
  invoiceId?: string;
  creditNoteId?: string;
  prepaymentId?: string;
  overpaymentId?: string;
  accountId: string;
  amount: number;
  bankAmount?: number;
  isReconciled?: boolean;
  date?: string;
  reference?: string;
  idempotencyKey?: string;
};

async function createPayment({
  invoiceId,
  creditNoteId,
  prepaymentId,
  overpaymentId,
  accountId,
  amount,
  bankAmount,
  isReconciled,
  date,
  reference,
  idempotencyKey,
}: PaymentProps): Promise<Payment | undefined> {
  const targetCount = [invoiceId, creditNoteId, prepaymentId, overpaymentId]
    .filter(Boolean)
    .length;

  if (targetCount !== 1) {
    throw new Error("Provide exactly one invoice, credit note, prepayment, or overpayment ID.");
  }

  await xeroClient.authenticate();

  const payment: Payment = {
    ...(invoiceId
      ? { invoice: { invoiceID: invoiceId } }
      : creditNoteId
        ? { creditNote: { creditNoteID: creditNoteId } }
        : prepaymentId
          ? { prepayment: { prepaymentID: prepaymentId } }
          : { overpayment: { overpaymentID: overpaymentId! } }),
    account: {
      accountID: accountId,
    },
    amount: amount,
    ...(bankAmount !== undefined ? { bankAmount } : {}),
    ...(isReconciled !== undefined ? { isReconciled } : {}),
    date,
    reference: reference,
  };

  const response = await xeroClient.accountingApi.createPayment(
    xeroClient.tenantId,
    payment,
    idempotencyKey,
    getClientHeaders(), // options
  );

  return response.body.payments?.[0];
}

/**
 * Create a new payment in Xero
 */
export async function createXeroPayment({
  invoiceId,
  creditNoteId,
  prepaymentId,
  overpaymentId,
  accountId,
  amount,
  bankAmount,
  isReconciled,
  date,
  reference,
  idempotencyKey,
}: PaymentProps): Promise<XeroClientResponse<Payment>> {
  try {
    const createdPayment = await createPayment({
      invoiceId,
      creditNoteId,
      prepaymentId,
      overpaymentId,
      accountId,
      amount,
      bankAmount,
      isReconciled,
      date,
      reference,
      idempotencyKey,
    });

    const successfulPayment = ensurePaymentSucceeded(createdPayment);

    return {
      result: successfulPayment,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
