import { TrackingCategory } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

type TrackingCategoryStatus = "ACTIVE" | "ARCHIVED";

async function getTrackingCategory(trackingCategoryId: string): Promise<TrackingCategory | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getTrackingCategory(
    xeroClient.tenantId,
    trackingCategoryId,
    getClientHeaders()
  );

  return response.body.trackingCategories?.[0];
}

async function updateTrackingCategory(
  trackingCategoryId: string,
  existingTrackingCategory: TrackingCategory,
  name?: string,
  status?: TrackingCategoryStatus
): Promise<TrackingCategory | undefined> {
  const trackingCategory: TrackingCategory = {
    trackingCategoryID: trackingCategoryId,
    name: name ? name : existingTrackingCategory.name,
    status: status ? TrackingCategory.StatusEnum[status] : existingTrackingCategory.status
  };

  await xeroClient.accountingApi.updateTrackingCategory(
    xeroClient.tenantId,
    trackingCategoryId,
    trackingCategory,
    undefined, // idempotencyKey
    getClientHeaders()
  );

  return trackingCategory;
}

export async function updateXeroTrackingCategory(
  trackingCategoryId: string,
  name?: string,
  status?: TrackingCategoryStatus
): Promise<XeroClientResponse<TrackingCategory>> {
  try {
    const existingTrackingCategory = await getTrackingCategory(trackingCategoryId);

    if (!existingTrackingCategory) {
      throw new Error("Could not find tracking category.");
    }

    const updatedTrackingCategory = await updateTrackingCategory(
      trackingCategoryId,
      existingTrackingCategory,
      name,
      status
    );

    if (!updatedTrackingCategory) {
      throw new Error("Failed to update tracking category.");
    }

    return {
      result: existingTrackingCategory,
      isError: false,
      error: null
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}