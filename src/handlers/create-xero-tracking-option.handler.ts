import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { TrackingOption } from "xero-node";

async function createTrackingOption(
  trackingCategoryId: string,
  name: string
): Promise<TrackingOption | undefined> {
  xeroClient.authenticate();
  
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

export async function createXeroTrackingOptions(
  trackingCategoryId: string,
  optionNames: string[]
): Promise<XeroClientResponse<TrackingOption[]>> {
  try {
    const createdOptions = await Promise.all(
      optionNames.map(async optionName => await createTrackingOption(trackingCategoryId, optionName))
    );

    return {
      result: createdOptions
        .filter(Boolean)
        .map(option => option as TrackingOption),
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
