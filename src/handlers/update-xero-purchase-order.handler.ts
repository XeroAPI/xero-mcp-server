import { PurchaseOrder } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import {
  PurchaseOrderLineItem,
  PurchaseOrderStatus,
  UPDATABLE_PURCHASE_ORDER_STATUSES,
} from "../types/purchase-order.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface UpdatePurchaseOrderParams {
  purchaseOrderId: string;
  lineItems?: PurchaseOrderLineItem[];
  date?: string;
  deliveryDate?: string;
  reference?: string;
  purchaseOrderNumber?: string;
  deliveryAddress?: string;
  attentionTo?: string;
  telephone?: string;
  deliveryInstructions?: string;
  contactId?: string;
  status?: PurchaseOrderStatus;
}

async function getPurchaseOrder(
  purchaseOrderId: string,
): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getPurchaseOrder(
    xeroClient.tenantId,
    purchaseOrderId,
    getClientHeaders(),
  );

  return response.body.purchaseOrders?.[0];
}

async function updatePurchaseOrder(
  params: UpdatePurchaseOrderParams,
): Promise<PurchaseOrder | undefined> {
  const purchaseOrder: PurchaseOrder = {
    lineItems: params.lineItems,
    date: params.date,
    deliveryDate: params.deliveryDate,
    reference: params.reference,
    purchaseOrderNumber: params.purchaseOrderNumber,
    deliveryAddress: params.deliveryAddress,
    attentionTo: params.attentionTo,
    telephone: params.telephone,
    deliveryInstructions: params.deliveryInstructions,
    contact: params.contactId ? { contactID: params.contactId } : undefined,
    status: params.status as PurchaseOrder.StatusEnum | undefined,
  };

  const response = await xeroClient.accountingApi.updatePurchaseOrder(
    xeroClient.tenantId,
    params.purchaseOrderId,
    {
      purchaseOrders: [purchaseOrder],
    },
    undefined,
    getClientHeaders(),
  );

  return response.body.purchaseOrders?.[0];
}

/**
 * Update an existing draft or submitted purchase order in Xero
 */
export async function updateXeroPurchaseOrder(
  params: UpdatePurchaseOrderParams,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    const existing = await getPurchaseOrder(params.purchaseOrderId);

    if (!existing) {
      return {
        result: null,
        isError: true,
        error: "Purchase order not found.",
      };
    }

    const currentStatus = existing.status as PurchaseOrderStatus | undefined;

    if (
      !currentStatus ||
      !UPDATABLE_PURCHASE_ORDER_STATUSES.includes(currentStatus)
    ) {
      return {
        result: null,
        isError: true,
        error: `Cannot update purchase order because it is ${currentStatus ?? "unknown"}. Only DRAFT and SUBMITTED purchase orders can be updated.`,
      };
    }

    const updatedPurchaseOrder = await updatePurchaseOrder(params);

    if (!updatedPurchaseOrder) {
      throw new Error("Purchase order update failed.");
    }

    return {
      result: updatedPurchaseOrder,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
