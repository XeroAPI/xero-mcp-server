import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroItems: vi.fn(),
}));

vi.mock("../../handlers/list-xero-items.handler.js", () => ({
  listXeroItems: mocks.listXeroItems,
}));

import ListItemsTool from "./list-items.tool.js";

describe("list-items tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the COGS and inventory asset accounts for tracked inventory", async () => {
    mocks.listXeroItems.mockResolvedValue({
      result: [{
        itemID: "item-id",
        code: "SKU-001",
        name: "Tracked Item",
        isTrackedAsInventory: true,
        inventoryAssetAccountCode: "140",
        purchaseDetails: { cOGSAccountCode: "500" },
      }],
      isError: false,
      error: null,
    });

    const result = await ListItemsTool().handler({ page: 1 }, {} as never);

    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining("COGS Account: 500"),
    });
    expect(result.content[1]).toMatchObject({
      text: expect.stringContaining("Inventory Asset Account: 140"),
    });
  });
});
