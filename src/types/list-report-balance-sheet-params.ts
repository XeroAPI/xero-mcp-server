import { timeframeType } from "./timeframeType.js";

// Define an interface for the balance sheet parameters
export interface ListReportBalanceSheetParams {
  date?: string;
  periods?: number;
  timeframe?: timeframeType;
  trackingOptionID1?: string;
  trackingOptionID2?: string;
  standardLayout?: boolean;
  paymentsOnly?: boolean;
}
