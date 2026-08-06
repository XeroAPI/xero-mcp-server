import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getTrackingCategory: vi.fn(),
  updateTrackingCategory: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    authenticate: mocks.authenticate,
    tenantId: "tenant-id",
    accountingApi: {
      getTrackingCategory: mocks.getTrackingCategory,
      updateTrackingCategory: mocks.updateTrackingCategory,
    },
  },
}));

import { updateXeroTrackingCategory } from "../update-xero-tracking-category.handler.js";

describe("updateXeroTrackingCategory", () => {
  it("returns the updated category rather than its previous value", async () => {
    mocks.authenticate.mockResolvedValueOnce(undefined);
    mocks.getTrackingCategory.mockResolvedValueOnce({
      body: {
        trackingCategories: [
          { trackingCategoryID: "category-id", name: "Old name", status: "ACTIVE" },
        ],
      },
    });
    mocks.updateTrackingCategory.mockResolvedValueOnce({ body: {} });

    await expect(
      updateXeroTrackingCategory("category-id", "New name"),
    ).resolves.toEqual({
      result: {
        trackingCategoryID: "category-id",
        name: "New name",
        status: "ACTIVE",
      },
      isError: false,
      error: null,
    });
  });
});
