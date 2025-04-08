import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Item } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getItems(
  page: number,
): Promise<Item[]> {
  await xeroClient.authenticate();

  const items = await xeroClient.accountingApi.getItems(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    undefined, // where
    undefined, // order
    page, // page
    getClientHeaders(),
  );
  return items.body.items ?? [];
}

/**
 * List all items from Xero
 */
export async function listXeroItems(
  page: number = 1,
): Promise<XeroClientResponse<Item[]>> {
  try {
    const items = await getItems(page);

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