import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { getXeroPurchaseOrder } from "./get-xero-purchase-order.handler.js";

const purchaseOrder = {
  purchaseOrderID: "po-1",
  purchaseOrderNumber: "PO-1001",
  status: "DRAFT",
  lineItems: [{ description: "Paper", quantity: 1, unitAmount: 10 }],
};

describe("getXeroPurchaseOrder", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("retrieves a purchase order by ID", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [purchaseOrder] },
    });

    const result = await getXeroPurchaseOrder({ purchaseOrderId: "po-1" });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.purchaseOrderID).toBe("po-1");
    expect(mockAccountingApi.getPurchaseOrder).toHaveBeenCalledWith(
      "tenant-1",
      "po-1",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockAccountingApi.getPurchaseOrderByNumber).not.toHaveBeenCalled();
  });

  it("retrieves a purchase order by number", async () => {
    mockAccountingApi.getPurchaseOrderByNumber.mockResolvedValue({
      body: { purchaseOrders: [purchaseOrder] },
    });

    const result = await getXeroPurchaseOrder({
      purchaseOrderNumber: "PO-1001",
    });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.purchaseOrderNumber).toBe("PO-1001");
    expect(mockAccountingApi.getPurchaseOrderByNumber).toHaveBeenCalledWith(
      "tenant-1",
      "PO-1001",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("prefers ID when both ID and number are provided", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [purchaseOrder] },
    });

    await getXeroPurchaseOrder({
      purchaseOrderId: "po-1",
      purchaseOrderNumber: "PO-1001",
    });

    expect(mockAccountingApi.getPurchaseOrder).toHaveBeenCalledOnce();
    expect(mockAccountingApi.getPurchaseOrderByNumber).not.toHaveBeenCalled();
  });

  it("returns an error when neither ID nor number is provided", async () => {
    const result = await getXeroPurchaseOrder({});

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Provide a purchaseOrderId or purchaseOrderNumber.",
    });
    expect(mockAccountingApi.getPurchaseOrder).not.toHaveBeenCalled();
  });

  it("returns an error when Xero returns no purchase order", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [] },
    });

    const result = await getXeroPurchaseOrder({ purchaseOrderId: "missing" });

    expect(result.isError).toBe(true);
    if (!result.isError) return;
    expect(result.error).toBe("Purchase order not found.");
  });
});
