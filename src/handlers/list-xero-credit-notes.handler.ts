import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { CreditNotes } from "xero-node";

/**
 * List all credit notes from Xero
 */
export async function listXeroCreditNotes(
  page: number = 1,
  contactId?: string,
): Promise<ToolResponse<CreditNotes>> {
  try {
    await xeroClient.authenticate();

    const { body: creditNotes } = await xeroClient.accountingApi.getCreditNotes(
      "", // tenantId (empty string for default)
      undefined, // ifModifiedSince
      contactId ? `Contact.ContactID=guid("${contactId}")` : undefined, // where
      "UpdatedDateUTC DESC", // order
      page, // page
      undefined, // unitdp
      10, // pageSize
      undefined, // options
    );

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