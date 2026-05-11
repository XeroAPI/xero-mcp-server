import { timeframeType } from "./timeframeType.js";

export interface ListProfitAndLossParams {
  fromDate?: string;
  toDate?: string;
  periods?: number;
  timeframe?: timeframeType;
  trackingCategoryID?: string;
  trackingCategoryID2?: string;
  trackingOptionID?: string;
  trackingOptionID2?: string;
  standardLayout?: boolean;
  paymentsOnly?: boolean;
}
