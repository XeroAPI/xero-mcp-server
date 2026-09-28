import { RepeatingInvoice } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function getRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<RepeatingInvoice | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getRepeatingInvoice(
    xeroClient.tenantId,
    repeatingInvoiceId,
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

async function deleteRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<RepeatingInvoice | undefined> {
  const response = await xeroClient.accountingApi.updateRepeatingInvoice(
    xeroClient.tenantId,
    repeatingInvoiceId,
    {
      repeatingInvoices: [
        {
          status: RepeatingInvoice.StatusEnum.DELETED,
        },
      ],
    },
    undefined,
    getClientHeaders(),
  );

  return response.body.repeatingInvoices?.[0];
}

/**
 * Delete a repeating invoice template by setting its status to DELETED
 */
export async function deleteXeroRepeatingInvoice(
  repeatingInvoiceId: string,
): Promise<XeroClientResponse<RepeatingInvoice>> {
  try {
    const existing = await getRepeatingInvoice(repeatingInvoiceId);

    if (!existing) {
      return {
        result: null,
        isError: true,
        error: "Repeating invoice not found.",
      };
    }

    if (existing.status === RepeatingInvoice.StatusEnum.DELETED) {
      return {
        result: null,
        isError: true,
        error: "Repeating invoice is already deleted.",
      };
    }

    const deleted = await deleteRepeatingInvoice(repeatingInvoiceId);

    if (!deleted) {
      throw new Error("Repeating invoice delete failed.");
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
