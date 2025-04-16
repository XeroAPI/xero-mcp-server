import { xeroClient } from "../clients/xero-client.js";
import { ContactGroup } from "xero-node";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getContactGroups(contactGroupId?: string): Promise<ContactGroup[]> {
  await xeroClient.authenticate();

  if (contactGroupId) {
    const response = await xeroClient.accountingApi.getContactGroup(
      xeroClient.tenantId,
      contactGroupId,
      getClientHeaders(),
    );
    return response.body.contactGroups ?? [];
  }

  const response = await xeroClient.accountingApi.getContactGroups(
    xeroClient.tenantId,
    undefined, // where
    undefined, // order
    getClientHeaders(),
  );
  return response.body.contactGroups ?? [];
}

/**
 * List all contact groups from Xero. If a contactGroupId is provided, it will return only that contact group.
 */
export async function listXeroContactGroups(contactGroupId?: string): Promise<
  XeroClientResponse<ContactGroup[]>
> {
  try {
    const contactGroups = await getContactGroups(contactGroupId);

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
