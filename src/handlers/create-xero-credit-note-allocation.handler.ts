import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Allocation, Allocations } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export type AllocationLine = {
  invoiceId: string;
  amount: number;
  date: string;
};

function toAllocations(lines: AllocationLine[]): Allocations {
  return {
    allocations: lines.map((line) => ({
      invoice: { invoiceID: line.invoiceId },
      amount: line.amount,
      date: line.date,
    })),
  };
}

/**
 * Apply a credit note to one or more invoices.
 */
export async function createXeroCreditNoteAllocation(
  creditNoteId: string,
  allocations: AllocationLine[],
): Promise<XeroClientResponse<Allocation[]>> {
  try {
    await xeroClient.authenticate();

    const response = await xeroClient.accountingApi.createCreditNoteAllocation(
      xeroClient.tenantId,
      creditNoteId,
      toAllocations(allocations),
      undefined, // summarizeErrors
      undefined, // idempotencyKey
      getClientHeaders(),
    );

    return {
      result: response.body.allocations ?? [],
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
