import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Payment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { postAuditNote } from "../helpers/post-audit-note.js";

type PaymentProps = {
  invoiceId: string;
  accountId: string;
  amount: number;
  date?: string;
  reference?: string;
  currencyRate?: number;
  isReconciled?: boolean;
  particulars?: string;
  details?: string;
  code?: string;
};

async function createPayment({
  invoiceId,
  accountId,
  amount,
  date,
  reference,
  currencyRate,
  isReconciled,
  particulars,
  details,
  code,
}: PaymentProps): Promise<Payment | undefined> {
  await xeroClient.authenticate();

  const payment: Payment = {
    invoice: {
      invoiceID: invoiceId,
    },
    account: {
      accountID: accountId,
    },
    amount: amount,
    date: date || new Date().toISOString().split("T")[0], // Today's date if not specified
    reference: reference,
    currencyRate,
    isReconciled,
    particulars,
    details,
    code,
  };

  const response = await xeroClient.accountingApi.createPayment(
    xeroClient.tenantId,
    payment,
    undefined, // idempotencyKey
    getClientHeaders(), // options
  );

  return response.body.payments?.[0];
}

/**
 * Create a new payment in Xero
 */
export async function createXeroPayment({
  invoiceId,
  accountId,
  amount,
  date,
  reference,
  currencyRate,
  isReconciled,
  particulars,
  details,
  code,
}: PaymentProps): Promise<XeroClientResponse<Payment>> {
  try {
    const createdPayment = await createPayment({
      invoiceId,
      accountId,
      amount,
      date,
      reference,
      currencyRate,
      isReconciled,
      particulars,
      details,
      code,
    });

    if (!createdPayment) {
      throw new Error("Payment creation failed.");
    }

    await postAuditNote("Payment", createdPayment.paymentID, "Created");


    return {
      result: createdPayment,
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
