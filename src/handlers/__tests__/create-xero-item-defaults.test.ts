import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createItems: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createItems: mocks.createItems,
    },
  },
}));

import { createXeroItem } from "../create-xero-item.handler.js";

describe("createXeroItem defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves sales and purchase availability to Xero's true defaults", async () => {
    mocks.createItems.mockResolvedValue({
      body: { items: [{ itemID: "item-id" }] },
    });

    const result = await createXeroItem({ code: "SKU-001", name: "Example item" });

    expect(result).toMatchObject({ isError: false, error: null });
    const item = mocks.createItems.mock.calls[0]?.[1].items[0];
    expect(item).not.toHaveProperty("isSold");
    expect(item).not.toHaveProperty("isPurchased");
  });
});
