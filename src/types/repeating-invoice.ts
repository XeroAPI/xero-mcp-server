import { LineItemTracking } from "xero-node";

export interface RepeatingInvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

export type RepeatingInvoiceType = "ACCREC" | "ACCPAY";

export type RepeatingInvoiceStatus = "DRAFT" | "AUTHORISED" | "DELETED";

export type RepeatingInvoiceScheduleUnit = "WEEKLY" | "MONTHLY";

export type RepeatingInvoiceDueDateType =
  | "DAYSAFTERBILLDATE"
  | "DAYSAFTERBILLMONTH"
  | "DAYSAFTERINVOICEDATE"
  | "DAYSAFTERINVOICEMONTH"
  | "OFCURRENTMONTH"
  | "OFFOLLOWINGMONTH";

export type RepeatingInvoiceLineAmountTypes =
  | "Exclusive"
  | "Inclusive"
  | "NoTax";

export interface RepeatingInvoiceScheduleInput {
  period: number;
  unit: RepeatingInvoiceScheduleUnit;
  dueDate: number;
  dueDateType: RepeatingInvoiceDueDateType;
  startDate: string;
  endDate?: string;
}

export const REPEATING_INVOICE_PAGE_SIZE = 10;
