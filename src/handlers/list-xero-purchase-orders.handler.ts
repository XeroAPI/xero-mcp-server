import { PurchaseOrder } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { PurchaseOrderStatus } from "../types/purchase-order.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface ListPurchaseOrdersParams {
  page?: number;
  status?: PurchaseOrderStatus;
  dateFrom?: string;
  dateTo?: string;
}

async function getPurchaseOrders(
  params: ListPurchaseOrdersParams,
): Promise<PurchaseOrder[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getPurchaseOrders(
    xeroClient.tenantId,
    undefined,
    params.status,
    params.dateFrom,
    params.dateTo,
    undefined,
    params.page ?? 1,
    10,
    getClientHeaders(),
  );

  return response.body.purchaseOrders ?? [];
}

/**
 * List purchase orders from Xero
 */
export async function listXeroPurchaseOrders(
  params: ListPurchaseOrdersParams = {},
): Promise<XeroClientResponse<PurchaseOrder[]>> {
  try {
    const purchaseOrders = await getPurchaseOrders(params);

    return {
      result: purchaseOrders,
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
