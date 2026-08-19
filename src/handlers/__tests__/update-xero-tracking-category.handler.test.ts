import { beforeEach, describe, expect, it, vi } from "vitest";

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

const existingCategory = {
  trackingCategoryID: "category-id",
  name: "Old name",
  status: "ACTIVE",
  options: [{ trackingOptionID: "option-id", name: "Option", status: "ACTIVE" }],
};

describe("updateXeroTrackingCategory", () => {
  beforeEach(() => {
    mocks.authenticate.mockReset();
    mocks.getTrackingCategory.mockReset();
    mocks.updateTrackingCategory.mockReset();

    mocks.authenticate.mockResolvedValue(undefined);
    mocks.getTrackingCategory.mockResolvedValue({
      body: { trackingCategories: [existingCategory] },
    });
  });

  it("returns the category from the update response, not the request payload", async () => {
    mocks.updateTrackingCategory.mockResolvedValueOnce({
      body: {
        trackingCategories: [
          {
            trackingCategoryID: "category-id",
            name: "New Name",
            status: "ACTIVE",
            options: existingCategory.options,
          },
        ],
      },
    });

    await expect(
      updateXeroTrackingCategory("category-id", "New name"),
    ).resolves.toEqual({
      result: {
        trackingCategoryID: "category-id",
        name: "New Name",
        status: "ACTIVE",
        options: existingCategory.options,
      },
      isError: false,
      error: null,
    });
  });

  it("reports an error when the update response contains no category", async () => {
    mocks.updateTrackingCategory.mockResolvedValueOnce({
      body: { trackingCategories: [] },
    });

    await expect(
      updateXeroTrackingCategory("category-id", "New name"),
    ).resolves.toEqual({
      result: null,
      isError: true,
      error: "Failed to update tracking category.",
    });
  });
});
