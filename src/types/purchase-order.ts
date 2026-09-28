import { LineItemTracking } from "xero-node";

export interface PurchaseOrderLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

export type PurchaseOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "AUTHORISED"
  | "BILLED"
  | "DELETED";

export const UPDATABLE_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "DRAFT",
  "SUBMITTED",
];
