import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Item } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getItems(): Promise<Item[]> {
  await xeroClient.authenticate();

  const items = await xeroClient.accountingApi.getItems(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    undefined, // where
    undefined, // order
    4, // unitdp: preserve item unit prices to four decimal places
    getClientHeaders(),
  );
  return items.body.items ?? [];
}

/**
 * List all items from Xero
 */
export async function listXeroItems(): Promise<XeroClientResponse<Item[]>> {
  try {
    const items = await getItems();

    return {
      result: items,
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
