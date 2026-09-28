import { PurchaseOrder } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface GetPurchaseOrderParams {
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
}

async function fetchPurchaseOrder(
  params: GetPurchaseOrderParams,
): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();

  if (params.purchaseOrderId) {
    const response = await xeroClient.accountingApi.getPurchaseOrder(
      xeroClient.tenantId,
      params.purchaseOrderId,
      getClientHeaders(),
    );
    return response.body.purchaseOrders?.[0];
  }

  if (params.purchaseOrderNumber) {
    const response = await xeroClient.accountingApi.getPurchaseOrderByNumber(
      xeroClient.tenantId,
      params.purchaseOrderNumber,
      getClientHeaders(),
    );
    return response.body.purchaseOrders?.[0];
  }

  return undefined;
}

/**
 * Retrieve a single purchase order from Xero
 */
export async function getXeroPurchaseOrder(
  params: GetPurchaseOrderParams,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    if (!params.purchaseOrderId && !params.purchaseOrderNumber) {
      return {
        result: null,
        isError: true,
        error: "Provide a purchaseOrderId or purchaseOrderNumber.",
      };
    }

    const purchaseOrder = await fetchPurchaseOrder(params);

    if (!purchaseOrder) {
      return {
        result: null,
        isError: true,
        error: "Purchase order not found.",
      };
    }

    return {
      result: purchaseOrder,
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
