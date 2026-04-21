import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Asset, AssetStatus, AssetStatusQueryParam, BookDepreciationSetting, BookDepreciationDetail } from "xero-node/dist/gen/model/assets/models.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function updateAsset(asset: Asset): Promise<Asset> {
  if (!asset.assetId) {
    throw new Error("Asset ID is required for update.");
  }
  
  await xeroClient.authenticate();

  const response = await xeroClient.assetApi.createAsset(
    xeroClient.tenantId,
    asset,
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body;
}

/**
 * Update an asset in Xero
 */
export async function updateXeroAsset(asset: Asset): Promise<XeroClientResponse<Asset>> {
  try {
    const updatedAsset = await updateAsset(asset);

    if (!updatedAsset) {
      throw new Error("Asset update failed.");
    }

    return {
      result: updatedAsset,
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

async function getAsset(assetNumber: string): Promise<Asset> {
  await xeroClient.authenticate();

  const response = await xeroClient.assetApi.getAssets(
    xeroClient.tenantId,
    AssetStatusQueryParam.DRAFT,
    undefined,
    undefined,
    undefined,
    undefined,
    assetNumber, // filterBy
    getClientHeaders(),
  );

  const matchedAsset = response.body.items?.[0];

  if (!matchedAsset) {
    throw new Error("Asset not found for update. Please check the asset ID and status.");
  }

  return matchedAsset;
}

/**
 * Populate asset for update based on provided parameters. It gets existing information if any of them is not provided.
 */
export async function populateAssetForUpdate(
  rawAsset: RawAssetForUpdate
): Promise<XeroClientResponse<Asset>> {
  const {
    assetId,
    assetName,
    assetNumber,
    assetTypeId,
    purchaseDate,
    purchasePrice,
    warrantyExpiryDate,
    serialNumber,
    disposalDate,
    disposalPrice,
    depreciationMethod,
    averagingMethod,
    depreciationRate,
    effectiveLifeYears,
    depreciationStartDate,
    costLimit,
    residualValue,
    priorAccumDepreciationAmount,
    currentAccumDepreciationAmount,
  } = rawAsset;

  try {
    const currentAsset = await getAsset(assetNumber);

    const bookDepreciationSetting = {
      ...currentAsset?.bookDepreciationSetting,
      depreciationMethod: depreciationMethod ?? currentAsset?.bookDepreciationSetting?.depreciationMethod,
      averagingMethod: averagingMethod ?? currentAsset?.bookDepreciationSetting?.averagingMethod,
      depreciationRate: depreciationRate ?? currentAsset?.bookDepreciationSetting?.depreciationRate,
      effectiveLifeYears: effectiveLifeYears ?? currentAsset?.bookDepreciationSetting?.effectiveLifeYears,
    } as BookDepreciationSetting;
    
    const bookDepreciationDetail = {
      ...currentAsset?.bookDepreciationDetail,
      depreciationStartDate: depreciationStartDate ?? currentAsset?.bookDepreciationDetail?.depreciationStartDate,
      costLimit: costLimit ?? currentAsset?.bookDepreciationDetail?.costLimit,
      residualValue: residualValue ?? currentAsset?.bookDepreciationDetail?.residualValue,
      priorAccumDepreciationAmount: priorAccumDepreciationAmount ?? currentAsset?.bookDepreciationDetail?.priorAccumDepreciationAmount,
      currentAccumDepreciationAmount: currentAccumDepreciationAmount ?? currentAsset?.bookDepreciationDetail?.currentAccumDepreciationAmount,
    } as BookDepreciationDetail;

    const assetForUpdate: Asset = {
      ...currentAsset,
      assetNumber,
      assetStatus: AssetStatus.Draft,
      assetId: assetId ?? currentAsset?.assetId,
      assetName: assetName ?? currentAsset?.assetName ?? "",
      assetTypeId: assetTypeId ?? currentAsset?.assetTypeId,
      purchaseDate: purchaseDate ?? currentAsset?.purchaseDate,
      purchasePrice: purchasePrice ?? currentAsset?.purchasePrice,
      warrantyExpiryDate: warrantyExpiryDate ?? currentAsset?.warrantyExpiryDate,
      serialNumber: serialNumber ?? currentAsset?.serialNumber,
      disposalDate: disposalDate ?? currentAsset?.disposalDate,
      disposalPrice: disposalPrice ?? currentAsset?.disposalPrice,
      bookDepreciationSetting,
      bookDepreciationDetail,
    };

    return {
      result: assetForUpdate,
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

export type RawAssetForUpdate = {
  assetNumber: string,
  assetStatus: string,
  assetId?: string,
  assetName?: string,
  assetTypeId?: string,
  purchaseDate?: string,
  purchasePrice?: number,
  warrantyExpiryDate?: string,
  serialNumber?: string,
  disposalDate?: string,
  disposalPrice?: number,
  depreciationMethod?: string,
  averagingMethod?: string,
  depreciationRate?: number,
  effectiveLifeYears?: number,
  depreciationStartDate?: string,
  costLimit?: number,
  residualValue?: number,
  priorAccumDepreciationAmount?: number,
  currentAccumDepreciationAmount?: number,
}
