import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { PurchaseOrder } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getPurchaseOrderById(
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

async function getPurchaseOrderByNumber(
  purchaseOrderNumber: string,
): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getPurchaseOrderByNumber(
    xeroClient.tenantId,
    purchaseOrderNumber,
    getClientHeaders(),
  );
  return response.body.purchaseOrders?.[0];
}

/**
 * Get a single purchase order from Xero by ID or number
 */
export async function getXeroPurchaseOrder(
  purchaseOrderId?: string,
  purchaseOrderNumber?: string,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    let purchaseOrder: PurchaseOrder | undefined;

    if (purchaseOrderId) {
      purchaseOrder = await getPurchaseOrderById(purchaseOrderId);
    } else if (purchaseOrderNumber) {
      purchaseOrder = await getPurchaseOrderByNumber(purchaseOrderNumber);
    } else {
      throw new Error("Either purchaseOrderId or purchaseOrderNumber must be provided.");
    }

    if (!purchaseOrder) {
      throw new Error("Purchase order not found.");
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
