import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { RepeatingInvoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

/**
 * Delete a repeating-invoice template in Xero.
 *
 * Xero has no DELETE endpoint for repeating invoices. Deletion is a POST to
 * /RepeatingInvoices carrying the template's ID and status=DELETED. (The API also does
 * not support editing an existing template — POST-with-ID is only valid for deletion —
 * so create and delete are the only mutations available.)
 */
export async function deleteXeroRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    await xeroClient.authenticate();

    const response = await xeroClient.accountingApi.updateOrCreateRepeatingInvoices(
      xeroClient.tenantId,
      {
        repeatingInvoices: [
          {
            repeatingInvoiceID: repeatingInvoiceId,
            status: RepeatingInvoice.StatusEnum.DELETED,
          },
        ],
      },
      true, // summarizeErrors
      undefined, // idempotencyKey
      getClientHeaders(),
    );

    const deleted = response.body.repeatingInvoices?.[0];
    if (!deleted) {
      throw new Error("Repeating invoice deletion failed.");
    }

    return {
      result: deleted,
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
