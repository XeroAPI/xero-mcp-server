import { xeroClient } from "../clients/xero-client.js";
import { Contact } from "xero-node";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getContacts(page?: number): Promise<Contact[]> {
  await xeroClient.authenticate();

  const contacts = await xeroClient.accountingApi.getContacts(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    undefined, // where
    undefined, // order
    undefined, // iDs
    page, // page
    undefined, // includeArchived
    true, // summaryOnly
    undefined, // pageSize
    undefined, // searchTerm
    getClientHeaders(),
  );
  return contacts.body.contacts ?? [];
}

/**
 * List all contacts from Xero
 */
export async function listXeroContacts(page?: number): Promise<
  XeroClientResponse<Contact[]>
> {
  try {
    const contacts = await getContacts(page);

    return {
      result: contacts,
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
