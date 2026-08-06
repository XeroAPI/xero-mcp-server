import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getItems: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    authenticate: mocks.authenticate,
    tenantId: "tenant-id",
    accountingApi: {
      getItems: mocks.getItems,
    },
  },
}));

import { listXeroItems } from "../list-xero-items.handler.js";

describe("listXeroItems", () => {
  it("requests four-decimal item prices without passing an unsupported page number", async () => {
    mocks.authenticate.mockResolvedValueOnce(undefined);
    mocks.getItems.mockResolvedValueOnce({ body: { items: [] } });

    await expect(listXeroItems()).resolves.toMatchObject({
      result: [],
      isError: false,
    });

    expect(mocks.getItems).toHaveBeenCalledWith(
      "tenant-id",
      undefined,
      undefined,
      undefined,
      4,
      expect.any(Object),
    );
  });
});
