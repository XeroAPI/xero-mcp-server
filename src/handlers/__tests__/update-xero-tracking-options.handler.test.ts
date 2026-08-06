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
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue(undefined);
  });

  it("fails before updating when any requested option does not exist", async () => {
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

  it("serializes writes and reports individual update failures", async () => {
    mocks.getTrackingCategory.mockResolvedValue({
      body: {
        trackingCategories: [{
          options: [
            { trackingOptionID: "one", name: "One", status: "ACTIVE" },
            { trackingOptionID: "fail", name: "Fail", status: "ACTIVE" },
            { trackingOptionID: "two", name: "Two", status: "ACTIVE" },
          ],
        }],
      },
    });

    let inFlight = 0;
    let maxInFlight = 0;
    mocks.updateTrackingOptions.mockImplementation(async (
      _tenantId: string,
      _categoryId: string,
      trackingOptionId: string,
      payload: { name?: string },
    ) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;

      if (trackingOptionId === "fail") {
        throw new Error("update failed");
      }

      return {
        body: {
          options: [{ trackingOptionID: trackingOptionId, name: payload.name }],
        },
      };
    });

    const result = await updateXeroTrackingOption("category-id", [
      { trackingOptionId: "one", name: "One updated" },
      { trackingOptionId: "fail", name: "Fail updated" },
      { trackingOptionId: "two", name: "Two updated" },
    ]);

    expect(maxInFlight).toBe(1);
    expect(result).toMatchObject({
      isError: false,
      result: {
        trackingOptions: [
          { trackingOptionID: "one", name: "One updated" },
          { trackingOptionID: "two", name: "Two updated" },
        ],
        failures: [{ input: "fail", error: "update failed" }],
      },
    });
  });
});
