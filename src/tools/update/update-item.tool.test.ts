import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateXeroItem: vi.fn(),
}));

vi.mock("../../handlers/update-xero-item.handler.js", () => ({
  updateXeroItem: mocks.updateXeroItem,
}));

import UpdateItemTool from "./update-item.tool.js";

describe("update-item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateXeroItem.mockResolvedValue({
      result: { itemID: "item-id", code: "SKU-001", name: "Example item" },
      isError: false,
      error: null,
    });
  });

  it("forwards explicit sales and purchase availability", async () => {
    await UpdateItemTool().handler({
      itemId: "item-id",
      code: "SKU-001",
      name: "Example item",
      isSold: false,
      isPurchased: true,
    }, {} as never);

    expect(mocks.updateXeroItem).toHaveBeenCalledWith("item-id", {
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
