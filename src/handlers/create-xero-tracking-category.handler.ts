import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { TrackingCategory } from "xero-node";

async function createTrackingCategory(
  name: string
): Promise<TrackingCategory | undefined> {
  xeroClient.authenticate();

  const trackingCategory: TrackingCategory = {
    name: name
  };

  const response = await xeroClient.accountingApi.createTrackingCategory(
    xeroClient.tenantId, // xeroTenantId
    trackingCategory,
    undefined, // idempotencyKey
    getClientHeaders() // options
  );

  const createdTrackingCategory = response.body.trackingCategories?.[0];

  return createdTrackingCategory;
}

async function createTrackingOption(
  trackingCategoryId: string,
  name: string
): Promise<TrackingCategory | undefined> {
  const response = await xeroClient.accountingApi.createTrackingOptions(
    xeroClient.tenantId,
    trackingCategoryId,
    {
      name: name
    },
    undefined, // idempotencyKey
    getClientHeaders()
  );

  const createdTrackingOption = response.body.options?.[0];

  return createdTrackingOption;
}

export async function createXeroTrackingCategory(
  name: string,
  optionNames: string[]
): Promise<XeroClientResponse<TrackingCategory>> {
  try {
    const createdTrackingCategory = await createTrackingCategory(name);
    const trackingCategoryId = createdTrackingCategory?.trackingCategoryID;

    if (!createdTrackingCategory || !trackingCategoryId) {
      throw new Error("Tracking Category creation failed.");
    }

    const createdOptions = optionNames.map(optionName => createTrackingOption(trackingCategoryId, optionName));

    if (createdOptions.some(option => !option)) {
      throw new Error("Creation of one or more Tracking Options failed.");
    }

    return {
      result: createdTrackingCategory,
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