import { BankTransaction } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { isGuid } from "../helpers/build-bank-transactions-where.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getBankTransaction(
  bankTransactionId: string,
): Promise<BankTransaction | null> {
  if (!isGuid(bankTransactionId)) {
    throw new Error(
      `Invalid bankTransactionId "${bankTransactionId}". Expected a Xero BankTransactionID (GUID).`,
    );
  }

  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getBankTransaction(
    xeroClient.tenantId, // xeroTenantId
    bankTransactionId, // bankTransactionID
    undefined, // unitdp
    getClientHeaders(), // options
  );

  return response.body.bankTransactions?.[0] ?? null;
}

/**
 * Get a single bank transaction from Xero by its ID
 */
export async function getXeroBankTransaction(
  bankTransactionId: string,
): Promise<XeroClientResponse<BankTransaction | null>> {
  try {
    const bankTransaction = await getBankTransaction(bankTransactionId);

    return {
      result: bankTransaction,
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
