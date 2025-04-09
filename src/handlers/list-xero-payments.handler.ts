import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Payment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getPayments(
  page: number,
  paymentId?: string,
): Promise<Payment[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getPayments(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    paymentId ? `PaymentId=guid("${paymentId}")` : undefined, // where
    "UpdatedDateUTC DESC", // order
    page, // page
    10, // pageSize
    getClientHeaders(),
  );

  return response.body.payments ?? [];
}

/**
 * List all credit notes from Xero
 */
export async function listXeroPayments(
  page: number = 1,
  paymentId?: string,
): Promise<XeroClientResponse<Payment[]>> {
  try {
    const payments = await getPayments(page, paymentId);

    return {
      result: payments,
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
