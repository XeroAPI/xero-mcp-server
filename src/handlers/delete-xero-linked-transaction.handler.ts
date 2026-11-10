import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function deleteLinkedTransaction(linkedTransactionId: string): Promise<boolean> {
  await xeroClient.authenticate();

  await xeroClient.accountingApi.deleteLinkedTransaction(
    xeroClient.tenantId,
    linkedTransactionId,
    getClientHeaders(),
  );

  return true;
}

/**
 * Delete a linked transaction (billable expense) in Xero
 */
export async function deleteXeroLinkedTransaction(
  linkedTransactionId: string,
): Promise<XeroClientResponse<boolean>> {
  try {
    await deleteLinkedTransaction(linkedTransactionId);

    return {
      result: true,
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
