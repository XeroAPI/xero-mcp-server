import { xeroClient } from "../clients/xero-client.js";
import { Allocation } from "xero-node";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function deleteCreditNoteAllocation(
  creditNoteId: string,
  allocationId: string,
): Promise<Allocation> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.deleteCreditNoteAllocations(
    xeroClient.tenantId,
    creditNoteId, // creditNoteID
    allocationId, // allocationID
    getClientHeaders(), // options
  );

  return response.body;
}

/**
 * Delete (remove) an allocation from a credit note in Xero,
 * returning the allocated amount to the credit note's remaining credit.
 */
export async function deleteXeroCreditNoteAllocation(
  creditNoteId: string,
  allocationId: string,
): Promise<XeroClientResponse<Allocation>> {
  try {
    const deletedAllocation = await deleteCreditNoteAllocation(
      creditNoteId,
      allocationId,
    );

    return {
      result: deletedAllocation,
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
