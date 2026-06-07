import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Asset, BookDepreciationSetting, BookDepreciationDetail } from "xero-node/dist/gen/model/assets/models.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function createAsset(
  assetName: string,
  assetNumber?: string,
  assetTypeId?: string,
  purchaseDate?: string,
  purchasePrice?: number,
  warrantyExpiryDate?: string,
  serialNumber?: string,
  bookDepreciationSetting?: BookDepreciationSetting,
  bookDepreciationDetail?: BookDepreciationDetail,
): Promise<Asset> {
  await xeroClient.authenticate();

  const asset: Asset = {
    assetName,
    assetNumber,
    assetTypeId,
    purchaseDate,
    purchasePrice,
    warrantyExpiryDate,
    serialNumber,
    bookDepreciationSetting,
    bookDepreciationDetail,
  };

  const response = await xeroClient.assetApi.createAsset(
    xeroClient.tenantId,
    asset,
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body;
}

/**
 * Create a new asset in Xero
 */
export async function createXeroAsset(
  assetName: string,
  assetNumber?: string,
  assetTypeId?: string,
  purchaseDate?: string,
  purchasePrice?: number,
  warrantyExpiryDate?: string,
  serialNumber?: string,
  bookDepreciationSetting?: BookDepreciationSetting,
  bookDepreciationDetail?: BookDepreciationDetail,
): Promise<XeroClientResponse<Asset>> {
  try {
    const createdAsset = await createAsset(
      assetName,
      assetNumber,
      assetTypeId,
      purchaseDate,
      purchasePrice,
      warrantyExpiryDate,
      serialNumber,
      bookDepreciationSetting,
      bookDepreciationDetail,
    );

    if (!createdAsset) {
      throw new Error("Asset creation failed.");
    }

    return {
      result: createdAsset,
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
