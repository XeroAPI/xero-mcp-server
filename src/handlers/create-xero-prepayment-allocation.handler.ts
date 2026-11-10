import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Allocation, Allocations } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { AllocationLine } from "./create-xero-credit-note-allocation.handler.js";

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
 * Apply a prepayment to one or more invoices.
 */
export async function createXeroPrepaymentAllocation(
  prepaymentId: string,
  allocations: AllocationLine[],
): Promise<XeroClientResponse<Allocation[]>> {
  try {
    await xeroClient.authenticate();

    const response = await xeroClient.accountingApi.createPrepaymentAllocations(
      xeroClient.tenantId,
      prepaymentId,
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
