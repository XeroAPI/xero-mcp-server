import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { LinkedTransaction } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getLinkedTransactions(
  page: number,
  linkedTransactionId?: string,
  sourceTransactionId?: string,
  contactId?: string,
  status?: string,
  targetTransactionId?: string,
): Promise<LinkedTransaction[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getLinkedTransactions(
    xeroClient.tenantId,
    page, // page
    linkedTransactionId, // linkedTransactionID
    sourceTransactionId, // sourceTransactionID
    contactId, // contactID
    status, // status
    targetTransactionId, // targetTransactionID
    getClientHeaders(),
  );

  return response.body.linkedTransactions ?? [];
}

/**
 * List linked transactions (billable expenses) from Xero
 */
export async function listXeroLinkedTransactions(
  page: number = 1,
  linkedTransactionId?: string,
  sourceTransactionId?: string,
  contactId?: string,
  status?: string,
  targetTransactionId?: string,
): Promise<XeroClientResponse<LinkedTransaction[]>> {
  try {
    const linkedTransactions = await getLinkedTransactions(
      page,
      linkedTransactionId,
      sourceTransactionId,
      contactId,
      status,
      targetTransactionId,
    );

    return {
      result: linkedTransactions,
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
