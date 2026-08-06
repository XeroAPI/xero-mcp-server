import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createXeroTrackingOptions: vi.fn(),
}));

vi.mock("../../handlers/create-xero-tracking-option.handler.js", () => ({
  createXeroTrackingOptions: mocks.createXeroTrackingOptions,
}));

import CreateTrackingOptionsTool from "./create-tracking-options.tool.js";

describe("create-tracking-options tool", () => {
  it("shows successful options alongside named partial failures", async () => {
    mocks.createXeroTrackingOptions.mockResolvedValue({
      result: {
        trackingOptions: [{ trackingOptionID: "option-id", name: "West", status: "ACTIVE" }],
        failures: [{ input: "East", error: "create failed" }],
      },
      isError: false,
      error: null,
    });

    const result = await CreateTrackingOptionsTool().handler({
      trackingCategoryId: "category-id",
      optionNames: ["West", "East"],
    }, {} as never);
    const text = result.content.find((content) => content.type === "text")?.text;

    expect(text).toContain("1 out of 2 tracking options created");
    expect(text).toContain("Name: West");
    expect(text).toContain("- East: create failed");
  });
});
