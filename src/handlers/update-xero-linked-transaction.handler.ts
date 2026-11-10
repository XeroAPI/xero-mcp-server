import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { LinkedTransaction } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

/**
 * Update a linked transaction (billable expense) in Xero — stage 2: allocate it onto a
 * sales-invoice line (set target) and/or change its source line, contact, or status.
 */
export async function updateXeroLinkedTransaction(
  linkedTransactionId: string,
  targetTransactionId?: string,
  targetLineItemId?: string,
  sourceLineItemId?: string,
  contactId?: string,
  status?: string,
): Promise<XeroClientResponse<LinkedTransaction>> {
  try {
    await xeroClient.authenticate();

    const linkedTransaction: LinkedTransaction = {
      targetTransactionID: targetTransactionId,
      targetLineItemID: targetLineItemId,
      sourceLineItemID: sourceLineItemId,
      contactID: contactId,
      status: status
        ? LinkedTransaction.StatusEnum[
            status as keyof typeof LinkedTransaction.StatusEnum
          ]
        : undefined,
    };

    const response = await xeroClient.accountingApi.updateLinkedTransaction(
      xeroClient.tenantId,
      linkedTransactionId,
      { linkedTransactions: [linkedTransaction] },
      undefined, // idempotencyKey
      getClientHeaders(),
    );

    const updated = response.body.linkedTransactions?.[0];
    if (!updated) {
      throw new Error("Linked transaction update failed.");
    }

    return {
      result: updated,
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
