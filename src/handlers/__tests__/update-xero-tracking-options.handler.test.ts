import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getTrackingCategory: vi.fn(),
  updateTrackingOptions: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    authenticate: mocks.authenticate,
    tenantId: "tenant-id",
    accountingApi: {
      getTrackingCategory: mocks.getTrackingCategory,
      updateTrackingOptions: mocks.updateTrackingOptions,
    },
  },
}));

import { updateXeroTrackingOption } from "../update-xero-tracking-options.handler.js";

describe("updateXeroTrackingOption", () => {
  beforeEach(() => {
    mocks.authenticate.mockReset();
    mocks.getTrackingCategory.mockReset();
    mocks.updateTrackingOptions.mockReset();

    mocks.authenticate.mockResolvedValue(undefined);
    mocks.getTrackingCategory.mockResolvedValue({
      body: {
        trackingCategories: [
          {
            trackingCategoryID: "category-id",
            options: [
              {
                trackingOptionID: "option-id",
                name: "Old name",
                status: "ACTIVE",
              },
            ],
          },
        ],
      },
    });
  });

  it("returns the option from the update response, not the request payload", async () => {
    mocks.updateTrackingOptions.mockResolvedValueOnce({
      body: {
        options: [
          {
            trackingOptionID: "option-id",
            name: "New Name",
            status: "ACTIVE",
          },
        ],
      },
    });

    await expect(
      updateXeroTrackingOption("category-id", [
        { trackingOptionId: "option-id", name: "New name" },
      ]),
    ).resolves.toEqual({
      result: [
        {
          trackingOptionID: "option-id",
          name: "New Name",
          status: "ACTIVE",
        },
      ],
      isError: false,
      error: null,
    });
  });

  it("drops options the update response does not return", async () => {
    mocks.updateTrackingOptions.mockResolvedValueOnce({ body: { options: [] } });

    await expect(
      updateXeroTrackingOption("category-id", [
        { trackingOptionId: "option-id", name: "New name" },
      ]),
    ).resolves.toEqual({
      result: [],
      isError: false,
      error: null,
    });
  });
});
