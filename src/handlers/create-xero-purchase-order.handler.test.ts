import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { createXeroPurchaseOrder } from "./create-xero-purchase-order.handler.js";

const lineItems = [
  {
    description: "Office chairs",
    quantity: 2,
    unitAmount: 150,
    accountCode: "429",
    taxType: "INPUT2",
  },
];

const createdPurchaseOrder = {
  purchaseOrderID: "po-1",
  purchaseOrderNumber: "PO-1001",
  status: "DRAFT",
  total: 300,
  contact: { contactID: "contact-1", name: "Northwind" },
};

describe("createXeroPurchaseOrder", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("creates a draft purchase order and returns it", async () => {
    mockAccountingApi.createPurchaseOrders.mockResolvedValue({
      body: { purchaseOrders: [createdPurchaseOrder] },
    });

    const result = await createXeroPurchaseOrder({
      contactId: "contact-1",
      lineItems,
    });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.purchaseOrderID).toBe("po-1");
    expect(result.result.purchaseOrderNumber).toBe("PO-1001");
    expect(mockXeroClient.authenticate).toHaveBeenCalledOnce();
    expect(mockAccountingApi.createPurchaseOrders).toHaveBeenCalledWith(
      "tenant-1",
      {
        purchaseOrders: [
          expect.objectContaining({
            contact: { contactID: "contact-1" },
            lineItems,
            status: "DRAFT",
          }),
        ],
      },
      true,
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("passes optional delivery and reference fields through to Xero", async () => {
    mockAccountingApi.createPurchaseOrders.mockResolvedValue({
      body: { purchaseOrders: [createdPurchaseOrder] },
    });

    await createXeroPurchaseOrder({
      contactId: "contact-1",
      lineItems,
      date: "2026-08-01",
      deliveryDate: "2026-08-15",
      reference: "JOB-44",
      purchaseOrderNumber: "PO-CUSTOM",
      deliveryAddress: "1 Warehouse Rd",
      attentionTo: "Receiving",
      telephone: "555-0100",
      deliveryInstructions: "Leave at dock 2",
    });

    const payload = mockAccountingApi.createPurchaseOrders.mock.calls[0][1];
    expect(payload.purchaseOrders[0]).toMatchObject({
      date: "2026-08-01",
      deliveryDate: "2026-08-15",
      reference: "JOB-44",
      purchaseOrderNumber: "PO-CUSTOM",
      deliveryAddress: "1 Warehouse Rd",
      attentionTo: "Receiving",
      telephone: "555-0100",
      deliveryInstructions: "Leave at dock 2",
    });
  });

  it("returns a formatted error when Xero rejects the create", async () => {
    mockAccountingApi.createPurchaseOrders.mockRejectedValue(
      new Error("Contact is required"),
    );

    const result = await createXeroPurchaseOrder({
      contactId: "missing",
      lineItems,
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Contact is required",
    });
  });

  it("returns an error when Xero returns no purchase order", async () => {
    mockAccountingApi.createPurchaseOrders.mockResolvedValue({
      body: { purchaseOrders: [] },
    });

    const result = await createXeroPurchaseOrder({
      contactId: "contact-1",
      lineItems,
    });

    expect(result.isError).toBe(true);
    if (!result.isError) return;
    expect(result.error).toBe("Purchase order creation failed.");
  });
});
