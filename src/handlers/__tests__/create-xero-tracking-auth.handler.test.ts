import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createTrackingCategory: vi.fn(),
  createTrackingOptions: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    authenticate: mocks.authenticate,
    tenantId: "",
    accountingApi: {
      createTrackingCategory: mocks.createTrackingCategory,
      createTrackingOptions: mocks.createTrackingOptions,
    },
  },
}));

import { createXeroTrackingCategory } from "../create-xero-tracking-category.handler.js";
import { createXeroTrackingOptions } from "../create-xero-tracking-option.handler.js";

const tenantSelectionFailure =
  "Multiple Xero tenant connections are available. Set XERO_TENANT_ID to the intended organisation's tenant ID.";

describe("tracking create handlers await authentication", () => {
  beforeEach(() => {
    mocks.authenticate.mockReset();
    mocks.createTrackingCategory.mockReset();
    mocks.createTrackingOptions.mockReset();

    mocks.authenticate.mockRejectedValue(new Error(tenantSelectionFailure));
    mocks.createTrackingCategory.mockResolvedValue({
      body: { trackingCategories: [{ trackingCategoryID: "category-id" }] },
    });
    mocks.createTrackingOptions.mockResolvedValue({
      body: { options: [{ trackingOptionID: "option-id" }] },
    });
  });

  it("reports a tenant selection failure instead of creating a category", async () => {
    await expect(createXeroTrackingCategory("Region")).resolves.toEqual({
      result: null,
      isError: true,
      error: tenantSelectionFailure,
    });
    expect(mocks.createTrackingCategory).not.toHaveBeenCalled();
  });

  it("reports a tenant selection failure instead of creating options", async () => {
    await expect(
      createXeroTrackingOptions("category-id", ["North", "South"]),
    ).resolves.toEqual({
      result: null,
      isError: true,
      error: tenantSelectionFailure,
    });
    expect(mocks.createTrackingOptions).not.toHaveBeenCalled();
  });
});
