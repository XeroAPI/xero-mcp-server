import { TrackingOption } from "xero-node";

export const formatTrackingOption = (option: TrackingOption): string => {
  return [
    `Option ID: ${option.trackingOptionID}`,
    `Name: ${option.name}`,
    `Status: ${option.status}`
  ].join("\n");
};