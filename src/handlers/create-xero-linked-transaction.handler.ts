import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { LinkedTransaction } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

/**
 * Create a linked transaction (billable expense) in Xero — stage 1: mark a source
 * bill/spend line as billable to a customer. Optionally allocate it onto a sales
 * invoice line in the same call by supplying the target fields.
 */
export async function createXeroLinkedTransaction(
  sourceTransactionId: string,
  sourceLineItemId: string,
  contactId: string,
  targetTransactionId?: string,
  targetLineItemId?: string,
): Promise<XeroClientResponse<LinkedTransaction>> {
  try {
    await xeroClient.authenticate();

    const linkedTransaction: LinkedTransaction = {
      sourceTransactionID: sourceTransactionId,
      sourceLineItemID: sourceLineItemId,
      contactID: contactId,
      targetTransactionID: targetTransactionId,
      targetLineItemID: targetLineItemId,
    };

    const response = await xeroClient.accountingApi.createLinkedTransaction(
      xeroClient.tenantId,
      linkedTransaction,
      undefined, // idempotencyKey
      getClientHeaders(),
    );

    const created = response.body.linkedTransactions?.[0];
    if (!created) {
      throw new Error("Linked transaction creation failed.");
    }

    return {
      result: created,
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
