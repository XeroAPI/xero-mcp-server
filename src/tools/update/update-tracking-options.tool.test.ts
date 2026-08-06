import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateXeroTrackingOption: vi.fn(),
}));

vi.mock("../../handlers/update-xero-tracking-options.handler.js", () => ({
  updateXeroTrackingOption: mocks.updateXeroTrackingOption,
}));

import UpdateTrackingOptionsTool from "./update-tracking-options.tool.js";

describe("update-tracking-options tool", () => {
  it("shows successful options alongside named partial failures", async () => {
    mocks.updateXeroTrackingOption.mockResolvedValue({
      result: {
        trackingOptions: [{ trackingOptionID: "option-id", name: "West", status: "ACTIVE" }],
        failures: [{ input: "option-east", error: "update failed" }],
      },
      isError: false,
      error: null,
    });

    const result = await UpdateTrackingOptionsTool().handler({
      trackingCategoryId: "category-id",
      options: [{ trackingOptionId: "option-id", name: "West" }, { trackingOptionId: "option-east" }],
    }, {} as never);
    const text = result.content.find((content) => content.type === "text")?.text;

    expect(text).toContain("1 out of 2 tracking options updated");
    expect(text).toContain("Name: West");
    expect(text).toContain("- option-east: update failed");
  });

  it("uses an updating error label", async () => {
    mocks.updateXeroTrackingOption.mockResolvedValue({
      result: null,
      isError: true,
      error: "category not found",
    });

    const result = await UpdateTrackingOptionsTool().handler({
      trackingCategoryId: "category-id",
      options: [{ trackingOptionId: "option-id" }],
    }, {} as never);
    const text = result.content.find((content) => content.type === "text")?.text;

    expect(text).toBe("Error while updating tracking options: category not found");
  });
});
