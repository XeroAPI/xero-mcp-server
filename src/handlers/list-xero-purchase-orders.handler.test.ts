import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { listXeroPurchaseOrders } from "./list-xero-purchase-orders.handler.js";

const purchaseOrders = [
  {
    purchaseOrderID: "po-1",
    purchaseOrderNumber: "PO-1001",
    status: "AUTHORISED",
    total: 120,
  },
];

describe("listXeroPurchaseOrders", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("lists purchase orders for the first page by default", async () => {
    mockAccountingApi.getPurchaseOrders.mockResolvedValue({
      body: { purchaseOrders },
    });

    const result = await listXeroPurchaseOrders();

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result).toEqual(purchaseOrders);
    expect(mockAccountingApi.getPurchaseOrders).toHaveBeenCalledWith(
      "tenant-1",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      10,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("forwards status and date filters", async () => {
    mockAccountingApi.getPurchaseOrders.mockResolvedValue({
      body: { purchaseOrders },
    });

    await listXeroPurchaseOrders({
      page: 2,
      status: "DRAFT",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    expect(mockAccountingApi.getPurchaseOrders).toHaveBeenCalledWith(
      "tenant-1",
      undefined,
      "DRAFT",
      "2026-01-01",
      "2026-01-31",
      undefined,
      2,
      10,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("returns an empty list when Xero omits purchaseOrders", async () => {
    mockAccountingApi.getPurchaseOrders.mockResolvedValue({ body: {} });

    const result = await listXeroPurchaseOrders({ page: 1 });

    expect(result).toEqual({
      result: [],
      isError: false,
      error: null,
    });
  });

  it("returns a formatted error when the list call fails", async () => {
    mockAccountingApi.getPurchaseOrders.mockRejectedValue(
      new Error("rate limited"),
    );

    const result = await listXeroPurchaseOrders({ page: 1 });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "rate limited",
    });
  });
});
