import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CreditNote } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getCreditNotes(
  contactId: string | undefined,
  page: number,
): Promise<CreditNote[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getCreditNotes(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    contactId ? `Contact.ContactID=guid("${contactId}")` : undefined, // where
    "UpdatedDateUTC DESC", // order
    page, // page
    undefined, // unitdp
    10, // pageSize
    getClientHeaders(),
  );

  return response.body.creditNotes ?? [];
}

/**
 * List all credit notes from Xero
 */
export async function listXeroCreditNotes(
  page: number = 1,
  contactId?: string,
): Promise<ToolResponse<CreditNote[]>> {
  try {
    const creditNotes = await getCreditNotes(contactId, page);

    return {
      result: creditNotes,
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
