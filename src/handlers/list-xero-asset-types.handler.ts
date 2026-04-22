import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { AssetType } from "xero-node/dist/gen/model/assets/models.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getAssetTypes(): Promise<AssetType[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.assetApi.getAssetTypes(
    xeroClient.tenantId,
    getClientHeaders(),
  );

  return response.body ?? [];
}

/**
 * List asset types from Xero
 */
export async function listXeroAssetTypes(): Promise<
  XeroClientResponse<AssetType[]>
> {
  try {
    const assetTypes = await getAssetTypes();

    return {
      result: assetTypes,
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
