import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CreditNote } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

const MAX_PAGE_SIZE = 100;

async function getCreditNotes(
  contactId: string | undefined,
  page: number,
  pageSize: number | undefined,
): Promise<CreditNote[]> {
  await xeroClient.authenticate();

  const resolvedPageSize = Math.min(pageSize ?? 10, MAX_PAGE_SIZE);

  const response = await xeroClient.accountingApi.getCreditNotes(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    contactId ? `Contact.ContactID=guid("${contactId}")` : undefined, // where
    "UpdatedDateUTC DESC", // order
    page, // page
    undefined, // unitdp
    resolvedPageSize, // pageSize
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
  pageSize?: number,
): Promise<XeroClientResponse<CreditNote[]>> {
  try {
    const creditNotes = await getCreditNotes(contactId, page, pageSize);

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
