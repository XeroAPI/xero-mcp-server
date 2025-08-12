import { createXeroClient } from "../clients/xero-client.js";
import { TrackingCategory } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

async function getTrackingCategories(
  bearerToken: string,
  includeArchived?: boolean
): Promise<TrackingCategory[]> {
  const xeroClient = createXeroClient(bearerToken);
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getTrackingCategories(
    xeroClient.tenantId, // xeroTenantId
    undefined, // where
    undefined, // order
    includeArchived, // includeArchived
    getClientHeaders()
  );

  return response.body.trackingCategories ?? [];
}

export async function listXeroTrackingCategories(
  bearerToken: string,
  includeArchived?: boolean
): Promise<XeroClientResponse<TrackingCategory[]>> {
  try {
    const trackingCategories = await getTrackingCategories(bearerToken, includeArchived);

    return {
      result: trackingCategories,
      isError: false,
      error: null
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error)
    };
  }
}