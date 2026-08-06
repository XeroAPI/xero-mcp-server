import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  updateItem: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      updateItem: mocks.updateItem,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { updateXeroItem } from "../update-xero-item.handler.js";

describe("updateXeroItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateItem.mockResolvedValue({
      body: { items: [{ itemID: "item-id" }] },
    });
  });

  it("sends explicitly selected sales and purchase availability", async () => {
    const result = await updateXeroItem("item-id", {
      code: "SKU-001",
      name: "Example item",
      isSold: false,
      isPurchased: true,
    });

    expect(result).toMatchObject({ isError: false, error: null });
    expect(mocks.updateItem).toHaveBeenCalledWith(
      "tenant-id",
      "item-id",
      {
        items: [expect.objectContaining({ isSold: false, isPurchased: true })],
      },
      4,
      undefined,
      { headers: {} },
    );
  });
});
