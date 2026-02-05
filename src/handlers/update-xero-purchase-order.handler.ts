import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { PurchaseOrder, LineItemTracking } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface PurchaseOrderLineItem {
  lineItemID?: string;
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
  itemCode?: string;
  tracking?: LineItemTracking[];
}

async function updatePurchaseOrder(
  purchaseOrderId: string,
  contactId: string | undefined,
  lineItems: PurchaseOrderLineItem[] | undefined,
  date: string | undefined,
  deliveryDate: string | undefined,
  reference: string | undefined,
  deliveryAddress: string | undefined,
  attentionTo: string | undefined,
  telephone: string | undefined,
  deliveryInstructions: string | undefined,
  status: PurchaseOrder.StatusEnum | undefined,
): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();

  const purchaseOrder: PurchaseOrder = {
    purchaseOrderID: purchaseOrderId,
  };

  if (contactId) {
    purchaseOrder.contact = { contactID: contactId };
  }
  if (lineItems) {
    purchaseOrder.lineItems = lineItems;
  }
  if (date) {
    purchaseOrder.date = date;
  }
  if (deliveryDate) {
    purchaseOrder.deliveryDate = deliveryDate;
  }
  if (reference !== undefined) {
    purchaseOrder.reference = reference;
  }
  if (deliveryAddress !== undefined) {
    purchaseOrder.deliveryAddress = deliveryAddress;
  }
  if (attentionTo !== undefined) {
    purchaseOrder.attentionTo = attentionTo;
  }
  if (telephone !== undefined) {
    purchaseOrder.telephone = telephone;
  }
  if (deliveryInstructions !== undefined) {
    purchaseOrder.deliveryInstructions = deliveryInstructions;
  }
  if (status) {
    purchaseOrder.status = status;
  }

  const response = await xeroClient.accountingApi.updatePurchaseOrder(
    xeroClient.tenantId,
    purchaseOrderId,
    {
      purchaseOrders: [purchaseOrder],
    },
    undefined, // idempotencyKey
    getClientHeaders(),
  );
  const updatedPurchaseOrder = response.body.purchaseOrders?.[0];
  return updatedPurchaseOrder;
}

/**
 * Update an existing purchase order in Xero
 */
export async function updateXeroPurchaseOrder(
  purchaseOrderId: string,
  contactId?: string,
  lineItems?: PurchaseOrderLineItem[],
  date?: string,
  deliveryDate?: string,
  reference?: string,
  deliveryAddress?: string,
  attentionTo?: string,
  telephone?: string,
  deliveryInstructions?: string,
  status?: PurchaseOrder.StatusEnum,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    const updatedPurchaseOrder = await updatePurchaseOrder(
      purchaseOrderId,
      contactId,
      lineItems,
      date,
      deliveryDate,
      reference,
      deliveryAddress,
      attentionTo,
      telephone,
      deliveryInstructions,
      status,
    );

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
