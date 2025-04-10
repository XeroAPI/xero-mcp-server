import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Item, Items } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface ItemDetails {
  code: string;
  name: string;
  description?: string;
  purchaseDescription?: string;
  purchaseDetails?: {
    unitPrice?: number;
    taxType?: string;
    accountCode?: string;
  };
  salesDetails?: {
    unitPrice?: number;
    taxType?: string;
    accountCode?: string;
  };
  isTrackedAsInventory?: boolean;
  inventoryAssetAccountCode?: string;
}

async function updateItem(
  itemId: string,
  itemDetails: ItemDetails
): Promise<Item | null> {
  await xeroClient.authenticate();

  const item: Partial<Item> = {
    code: itemDetails.code,
    name: itemDetails.name,
    description: itemDetails.description,
    purchaseDescription: itemDetails.purchaseDescription,
    purchaseDetails: itemDetails.purchaseDetails,
    salesDetails: itemDetails.salesDetails,
    isTrackedAsInventory: itemDetails.isTrackedAsInventory,
    inventoryAssetAccountCode: itemDetails.inventoryAssetAccountCode,
  };

  const items: Items = {
    items: [item as Item],
  };

  const response = await xeroClient.accountingApi.updateItem(
    xeroClient.tenantId,
    itemId,
    items,
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders()
  );

  return response.body.items?.[0] ?? null;
}

/**
 * Update an item in Xero
 * @param itemId - The ID of the item to update
 * @param itemDetails - The details to update on the item
 * @returns A response containing the updated item or error details
 */
export async function updateXeroItem(
  itemId: string,
  itemDetails: ItemDetails
): Promise<XeroClientResponse<Item | null>> {
  try {
    const item = await updateItem(itemId, itemDetails);

    return {
      result: item,
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