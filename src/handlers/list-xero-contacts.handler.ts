import { xeroClient } from "../clients/xero-client.js";
import { Contact } from "xero-node";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";

async function getContacts(): Promise<Contact[]> {
  await xeroClient.authenticate();

  const contacts = await xeroClient.accountingApi.getContacts(
    "", // tenantId (empty string for default)
    undefined, // ifModifiedSince
    undefined, // where
    undefined, // order
    undefined, // iDs
    undefined, // page
    undefined, // includeArchived
    true, // summaryOnly
    undefined, // pageSize
    undefined, // searchTerm
    {
      headers: { "user-agent": `xero-mcp-server-${getPackageVersion()}` },
    },
  );
  return contacts.body.contacts ?? [];
}

/**
 * List all contacts from Xero
 */
export async function listXeroContacts(): Promise<ToolResponse<Contact[]>> {
  try {
    const contacts = await getContacts();

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
