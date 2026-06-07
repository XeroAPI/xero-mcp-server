import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Assets, AssetStatusQueryParam } from "xero-node/dist/gen/model/assets/models.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function listAssets(
  status: AssetStatusQueryParam,
  page?: number,
  pageSize?: number,
  orderBy?: "AssetType" | "AssetName" | "AssetNumber" | "PurchaseDate" | "PurchasePrice" | "DisposalDate" | "DisposalPrice",
  sortDirection?: "asc" | "desc",
  filterBy?: string,
): Promise<Assets> {
  await xeroClient.authenticate();

  const response = await xeroClient.assetApi.getAssets(
    xeroClient.tenantId,
    status,
    page,
    pageSize,
    orderBy,
    sortDirection,
    filterBy,
    getClientHeaders(),
  );

  return response.body;
}

/**
 * List assets from Xero
 */
export async function listXeroAssets(
  status: AssetStatusQueryParam,
  page?: number,
  pageSize?: number,
  orderBy?: "AssetType" | "AssetName" | "AssetNumber" | "PurchaseDate" | "PurchasePrice" | "DisposalDate" | "DisposalPrice",
  sortDirection?: "asc" | "desc",
  filterBy?: string,
): Promise<XeroClientResponse<Assets>> {
  try {
    const assets = await listAssets(status, page, pageSize, orderBy, sortDirection, filterBy);

    return {
      result: assets,
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
