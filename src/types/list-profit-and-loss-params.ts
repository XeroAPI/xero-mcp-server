import { timeframeType } from "./timeframeType.js";

// Define an interface for the profit and loss parameters
export interface ListProfitAndLossParams {
  fromDate?: string;
  toDate?: string;
  periods?: number;
  timeframe?: timeframeType;
  trackingCategoryID?: string;
  trackingOptionID?: string;
  trackingCategoryID2?: string;
  trackingOptionID2?: string;
  standardLayout?: boolean;
  paymentsOnly?: boolean;
}
