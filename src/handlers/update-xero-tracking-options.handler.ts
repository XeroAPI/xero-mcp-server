import { TrackingOption } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { TrackingOptionBatchResult } from "../types/tracking-option-batch.js";

type TrackingOptionStatus = "ACTIVE" | "ARCHIVED";

interface TrackingOptionItem {
  trackingOptionId: string,
  name?: string,
  status?: TrackingOptionStatus
}

async function getTrackingOptions(trackingCategoryId: string): Promise<TrackingOption[] | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getTrackingCategory(
    xeroClient.tenantId,
    trackingCategoryId,
    getClientHeaders()
  );

  return response.body.trackingCategories?.[0].options;
}

async function updateTrackingOption(
  trackingCategoryId: string,
  trackingOptionId: string,
  existingTrackingOption: TrackingOption,
  name?: string,
  status?: TrackingOptionStatus
): Promise<TrackingOption | undefined> {
  const trackingOption: TrackingOption = {
    trackingOptionID: trackingOptionId,
    name: name ?? existingTrackingOption.name,
    status: status !== undefined
      ? TrackingOption.StatusEnum[status]
      : existingTrackingOption.status,
  };

  const response = await xeroClient.accountingApi.updateTrackingOptions(
    xeroClient.tenantId,
    trackingCategoryId,
    trackingOptionId,
    trackingOption,
    undefined, // idempotencyKey
    getClientHeaders()
  );

  return response.body.options?.[0] ?? trackingOption;
}

export async function updateXeroTrackingOption(
  trackingCategoryId: string,
  options: TrackingOptionItem[]
): Promise<XeroClientResponse<TrackingOptionBatchResult>> {
  try {

    const existingTrackingOptions = await getTrackingOptions(trackingCategoryId);

    if (!existingTrackingOptions) {
      throw new Error("Could not find tracking options.");
    }

    const optionsById = new Map(
      existingTrackingOptions.map((option) => [option.trackingOptionID, option]),
    );
    const missingOptionIds = options
      .filter((option) => !optionsById.has(option.trackingOptionId))
      .map((option) => option.trackingOptionId);

    if (missingOptionIds.length > 0) {
      throw new Error(
        `Could not find tracking options: ${missingOptionIds.join(", ")}`,
      );
    }

    const trackingOptions: TrackingOption[] = [];
    const failures: TrackingOptionBatchResult["failures"] = [];

    // Xero permits at most five concurrent calls per tenant. Serial execution
    // prevents this batch from consuming all concurrent calls for the tenant.
    for (const option of options) {
      try {
        const trackingOption = await updateTrackingOption(
          trackingCategoryId,
          option.trackingOptionId,
          optionsById.get(option.trackingOptionId)!,
          option.name,
          option.status,
        );

        if (trackingOption) {
          trackingOptions.push(trackingOption);
        } else {
          failures.push({
            input: option.trackingOptionId,
            error: "Xero did not return the updated tracking option.",
          });
        }
      } catch (error) {
        failures.push({
          input: option.trackingOptionId,
          error: formatError(error),
        });
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
      error: formatError(error),
    };
  }
}
