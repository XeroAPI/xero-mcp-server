import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createXeroItem: vi.fn(),
}));

vi.mock("../../handlers/create-xero-item.handler.js", () => ({
  createXeroItem: mocks.createXeroItem,
}));

import CreateItemTool from "./create-item.tool.js";

describe("create-item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createXeroItem.mockResolvedValue({
      result: { itemID: "item-id", code: "SKU-001", name: "Example item" },
      isError: false,
      error: null,
    });
  });

  it("forwards explicit sales and purchase availability", async () => {
    await CreateItemTool().handler({
      code: "SKU-001",
      name: "Example item",
      isSold: false,
      isPurchased: true,
    }, {} as never);

    expect(mocks.createXeroItem).toHaveBeenCalledWith({
      code: "SKU-001",
      name: "Example item",
      description: undefined,
      purchaseDescription: undefined,
      purchaseDetails: undefined,
      salesDetails: undefined,
      isSold: false,
      isPurchased: true,
      isTrackedAsInventory: undefined,
      inventoryAssetAccountCode: undefined,
    });
  });
});
