import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTrackingOptions: vi.fn(),
  updateTrackingOptions: vi.fn(),
  listTrackingCategories: vi.fn(),
}));

vi.mock("../../handlers/create-xero-tracking-option.handler.js", () => ({
  createXeroTrackingOptions: mocks.createTrackingOptions,
}));

vi.mock("../../handlers/update-xero-tracking-options.handler.js", () => ({
  updateXeroTrackingOption: mocks.updateTrackingOptions,
}));

vi.mock("../../handlers/list-xero-tracking-categories.handler.js", () => ({
  listXeroTrackingCategories: mocks.listTrackingCategories,
}));

import CreateTrackingOptionsTool from "../create/create-tracking-options.tool.js";
import ListTrackingCategoriesTool from "../list/list-tracking-categories.tool.js";
import UpdateTrackingOptionsTool from "../update/update-tracking-options.tool.js";

const firstOption = {
  trackingOptionID: "first-option-id",
  name: "First option",
  status: "ACTIVE",
};

const secondOption = {
  trackingOptionID: "second-option-id",
  name: "Second option",
  status: "ARCHIVED",
};

const formattedOptions = [
  "Option ID: first-option-id",
  "Name: First option",
  "Status: ACTIVE",
  "",
  "Option ID: second-option-id",
  "Name: Second option",
  "Status: ARCHIVED",
].join("\n");

describe("tracking option tool output", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("separates newly created options into readable blocks", async () => {
    mocks.createTrackingOptions.mockResolvedValue({
      isError: false,
      result: [firstOption, secondOption],
    });

    const result = await CreateTrackingOptionsTool().handler({
      trackingCategoryId: "category-id",
      optionNames: ["First option", "Second option"],
    }, {} as never);

    expect(result.content).toEqual([{
      type: "text",
      text: `2 out of 2 tracking options created:\n${formattedOptions}`,
    }]);
  });

  it("labels tracking-option update failures accurately", async () => {
    mocks.updateTrackingOptions.mockResolvedValue({
      isError: true,
      error: "Option not found",
    });

    const result = await UpdateTrackingOptionsTool().handler({
      trackingCategoryId: "category-id",
      options: [{ trackingOptionId: "option-id" }],
    }, {} as never);

    expect(result.content).toEqual([{
      type: "text",
      text: "Error while updating tracking options: Option not found",
    }]);
  });

  it("separates options in each listed tracking category", async () => {
    mocks.listTrackingCategories.mockResolvedValue({
      isError: false,
      result: [{
        trackingCategoryID: "category-id",
        name: "Region",
        status: "ACTIVE",
        options: [firstOption, secondOption],
      }],
    });

    const result = await ListTrackingCategoriesTool().handler({}, {} as never);

    expect(result.content).toEqual([
      { type: "text", text: "Found 1 tracking categories:" },
      {
        type: "text",
        text: [
          "Tracking Category ID: category-id",
          "Name: Region",
          "Status: ACTIVE",
          `Found 2 tracking options:\n${formattedOptions}`,
        ].join("\n"),
      },
    ]);
  });
});
