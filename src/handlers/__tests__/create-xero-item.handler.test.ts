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

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { createXeroItem } from "../create-xero-item.handler.js";

describe("createXeroItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createItems.mockResolvedValue({
      body: { items: [{ itemID: "item-id", code: "SKU-001" }] },
    });
  });

  it("preserves sales and purchase defaults when no unit price is supplied", async () => {
    const result = await createXeroItem({
      code: "SKU-001",
      salesDetails: { accountCode: "200", taxType: "OUTPUT2" },
      purchaseDetails: { accountCode: "300", taxType: "INPUT2" },
    });

    expect(result.isError).toBe(false);
    expect(mocks.createItems.mock.calls[0][1]).toMatchObject({
      items: [
        {
          isSold: true,
          isPurchased: true,
          salesDetails: { accountCode: "200", taxType: "OUTPUT2" },
          purchaseDetails: { accountCode: "300", taxType: "INPUT2" },
        },
      ],
    });
  });

  it("leaves Xero sales and purchase availability defaults intact for a code-only item", async () => {
    const result = await createXeroItem({ code: "SKU-001" });

    expect(result.isError).toBe(false);

    const requestItem = mocks.createItems.mock.calls[0][1].items[0];
    expect(requestItem).not.toHaveProperty("isSold");
    expect(requestItem).not.toHaveProperty("isPurchased");
  });
});
