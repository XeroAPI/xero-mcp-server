import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { TrackingOption } from "xero-node";
import { TrackingOptionBatchResult } from "../types/tracking-option-batch.js";

async function createTrackingOption(
  trackingCategoryId: string,
  name: string
): Promise<TrackingOption | undefined> {
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
): Promise<XeroClientResponse<TrackingOptionBatchResult>> {
  try {
    await xeroClient.authenticate();

    const trackingOptions: TrackingOption[] = [];
    const failures: TrackingOptionBatchResult["failures"] = [];

    // Xero permits at most five concurrent calls per tenant. Process the batch
    // serially so a full batch cannot exhaust that shared tenant allowance.
    for (const optionName of optionNames) {
      try {
        const trackingOption = await createTrackingOption(trackingCategoryId, optionName);
        if (trackingOption) {
          trackingOptions.push(trackingOption);
        } else {
          failures.push({
            input: optionName,
            error: "Xero did not return the created tracking option.",
          });
        }
      } catch (error) {
        failures.push({ input: optionName, error: formatError(error) });
      }
    }

    return {
      result: { trackingOptions, failures },
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
