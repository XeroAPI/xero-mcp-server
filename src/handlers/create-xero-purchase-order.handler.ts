import { PurchaseOrder } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { PurchaseOrderLineItem } from "../types/purchase-order.js";
import { XeroClientResponse } from "../types/tool-response.js";

export interface CreatePurchaseOrderParams {
  contactId: string;
  lineItems: PurchaseOrderLineItem[];
  date?: string;
  deliveryDate?: string;
  reference?: string;
  purchaseOrderNumber?: string;
  deliveryAddress?: string;
  attentionTo?: string;
  telephone?: string;
  deliveryInstructions?: string;
}

async function createPurchaseOrder(
  params: CreatePurchaseOrderParams,
): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();

  const purchaseOrder: PurchaseOrder = {
    contact: {
      contactID: params.contactId,
    },
    lineItems: params.lineItems,
    date: params.date || new Date().toISOString().split("T")[0],
    deliveryDate: params.deliveryDate,
    reference: params.reference,
    purchaseOrderNumber: params.purchaseOrderNumber,
    deliveryAddress: params.deliveryAddress,
    attentionTo: params.attentionTo,
    telephone: params.telephone,
    deliveryInstructions: params.deliveryInstructions,
    status: PurchaseOrder.StatusEnum.DRAFT,
  };

  const response = await xeroClient.accountingApi.createPurchaseOrders(
    xeroClient.tenantId,
    {
      purchaseOrders: [purchaseOrder],
    },
    true,
    undefined,
    getClientHeaders(),
  );

  return response.body.purchaseOrders?.[0];
}

/**
 * Create a new purchase order in Xero
 */
export async function createXeroPurchaseOrder(
  params: CreatePurchaseOrderParams,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    const createdPurchaseOrder = await createPurchaseOrder(params);

    if (!createdPurchaseOrder) {
      throw new Error("Purchase order creation failed.");
    }

    return {
      result: createdPurchaseOrder,
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
