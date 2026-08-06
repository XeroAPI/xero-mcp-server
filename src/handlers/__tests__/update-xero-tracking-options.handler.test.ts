import { describe, expect, it, vi } from "vitest";

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
  it("fails before updating when any requested option does not exist", async () => {
    mocks.authenticate.mockResolvedValueOnce(undefined);
    mocks.getTrackingCategory.mockResolvedValueOnce({
      body: {
        trackingCategories: [
          { options: [{ trackingOptionID: "known", name: "Known", status: "ACTIVE" }] },
        ],
      },
    });

    await expect(
      updateXeroTrackingOption("category-id", [
        { trackingOptionId: "missing", name: "Renamed" },
      ]),
    ).resolves.toMatchObject({
      result: null,
      isError: true,
      error: "Could not find tracking options: missing",
    });
    expect(mocks.updateTrackingOptions).not.toHaveBeenCalled();
  });
});
