import { TrackingOption } from "xero-node";

export interface TrackingOptionBatchFailure {
  input: string;
  error: string;
}

export interface TrackingOptionBatchResult {
  trackingOptions: TrackingOption[];
  failures: TrackingOptionBatchFailure[];
}
