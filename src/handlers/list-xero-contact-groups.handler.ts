import { xeroClient } from "../clients/xero-client.js";
import { ContactGroup } from "xero-node";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getContactGroups(): Promise<ContactGroup[]> {
  await xeroClient.authenticate();

  const contactGroups = await xeroClient.accountingApi.getContactGroups(
    xeroClient.tenantId,
    undefined, // where
    undefined, // order
    getClientHeaders(),
  );
  return contactGroups.body.contactGroups ?? [];
}

/**
 * List all contact groups from Xero
 */
export async function listXeroContactGroups(): Promise<
  XeroClientResponse<ContactGroup[]>
> {
  try {
    const contactGroups = await getContactGroups();

    return {
      result: contactGroups,
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
