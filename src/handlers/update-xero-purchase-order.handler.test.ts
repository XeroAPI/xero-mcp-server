import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { updateXeroPurchaseOrder } from "./update-xero-purchase-order.handler.js";

const existingDraft = {
  purchaseOrderID: "po-1",
  status: "DRAFT",
  contact: { contactID: "contact-1", name: "Northwind" },
};

const updatedPurchaseOrder = {
  ...existingDraft,
  reference: "JOB-99",
  total: 80,
};

describe("updateXeroPurchaseOrder", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("updates a draft purchase order", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [existingDraft] },
    });
    mockAccountingApi.updatePurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [updatedPurchaseOrder] },
    });

    const result = await updateXeroPurchaseOrder({
      purchaseOrderId: "po-1",
      reference: "JOB-99",
      lineItems: [
        {
          description: "Toner",
          quantity: 1,
          unitAmount: 80,
          accountCode: "429",
          taxType: "INPUT2",
        },
      ],
    });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.reference).toBe("JOB-99");
    expect(mockAccountingApi.updatePurchaseOrder).toHaveBeenCalledWith(
      "tenant-1",
      "po-1",
      {
        purchaseOrders: [
          expect.objectContaining({
            reference: "JOB-99",
            lineItems: [
              expect.objectContaining({ description: "Toner", unitAmount: 80 }),
            ],
          }),
        ],
      },
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("allows updates to submitted purchase orders", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [{ ...existingDraft, status: "SUBMITTED" }] },
    });
    mockAccountingApi.updatePurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [updatedPurchaseOrder] },
    });

    const result = await updateXeroPurchaseOrder({
      purchaseOrderId: "po-1",
      deliveryInstructions: "Call on arrival",
    });

    expect(result.isError).toBe(false);
  });

  it("rejects billed purchase orders", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [{ ...existingDraft, status: "BILLED" }] },
    });

    const result = await updateXeroPurchaseOrder({
      purchaseOrderId: "po-1",
      reference: "nope",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error:
        "Cannot update purchase order because it is BILLED. Only DRAFT and SUBMITTED purchase orders can be updated.",
    });
    expect(mockAccountingApi.updatePurchaseOrder).not.toHaveBeenCalled();
  });

  it("rejects deleted purchase orders", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [{ ...existingDraft, status: "DELETED" }] },
    });

    const result = await updateXeroPurchaseOrder({
      purchaseOrderId: "po-1",
      reference: "nope",
    });

    expect(result.isError).toBe(true);
    if (!result.isError) return;
    expect(result.error).toContain("DELETED");
  });

  it("can authorise a draft purchase order", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [existingDraft] },
    });
    mockAccountingApi.updatePurchaseOrder.mockResolvedValue({
      body: {
        purchaseOrders: [{ ...existingDraft, status: "AUTHORISED" }],
      },
    });

    const result = await updateXeroPurchaseOrder({
      purchaseOrderId: "po-1",
      status: "AUTHORISED",
    });

    expect(result.isError).toBe(false);
    const payload = mockAccountingApi.updatePurchaseOrder.mock.calls[0][2];
    expect(payload.purchaseOrders[0].status).toBe("AUTHORISED");
  });

  it("returns an error when the existing purchase order cannot be loaded", async () => {
    mockAccountingApi.getPurchaseOrder.mockResolvedValue({
      body: { purchaseOrders: [] },
    });

    const result = await updateXeroPurchaseOrder({
      purchaseOrderId: "missing",
      reference: "x",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Purchase order not found.",
    });
  });
});
