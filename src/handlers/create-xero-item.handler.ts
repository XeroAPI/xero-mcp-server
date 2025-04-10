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
    unitPrice: number;
    taxType?: string;
    accountCode?: string;
  };
  salesDetails?: {
    unitPrice: number;
    taxType?: string;
    accountCode?: string;
  };
  isTrackedAsInventory?: boolean;
  inventoryAssetAccountCode?: string;
}

async function createItem(
  itemDetails: ItemDetails
): Promise<Item | null> {
  await xeroClient.authenticate();

  const item: Item = {
    code: itemDetails.code,
    name: itemDetails.name,
    description: itemDetails.description,
    purchaseDescription: itemDetails.purchaseDescription,
    isPurchased: !!itemDetails.purchaseDetails,
    isSold: !!itemDetails.salesDetails,
    purchaseDetails: itemDetails.purchaseDetails
      ? {
          unitPrice: itemDetails.purchaseDetails.unitPrice,
          taxType: itemDetails.purchaseDetails.taxType,
          accountCode: itemDetails.purchaseDetails.accountCode,
        }
      : undefined,
    salesDetails: itemDetails.salesDetails
      ? {
          unitPrice: itemDetails.salesDetails.unitPrice,
          taxType: itemDetails.salesDetails.taxType,
          accountCode: itemDetails.salesDetails.accountCode,
        }
      : undefined,
    isTrackedAsInventory: itemDetails.isTrackedAsInventory,
    inventoryAssetAccountCode: itemDetails.inventoryAssetAccountCode,
  };

  const items: Items = {
    items: [item],
  };

  const response = await xeroClient.accountingApi.createItems(
    xeroClient.tenantId,
    items, // items
    true, // summarizeErrors
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders()
  );

  return response.body.items?.[0] ?? null;
}

/**
 * Create an item in Xero
 */
export async function createXeroItem(
  itemDetails: ItemDetails
): Promise<XeroClientResponse<Item | null>> {
  try {
    const item = await createItem(itemDetails);

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