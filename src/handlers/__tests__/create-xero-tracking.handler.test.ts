import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createTrackingCategory: vi.fn(),
  createTrackingOptions: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    authenticate: mocks.authenticate,
    tenantId: "tenant-id",
    accountingApi: {
      createTrackingCategory: mocks.createTrackingCategory,
      createTrackingOptions: mocks.createTrackingOptions,
    },
  },
}));

import { createXeroTrackingCategory } from "../create-xero-tracking-category.handler.js";
import { createXeroTrackingOptions } from "../create-xero-tracking-option.handler.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe("tracking creation handlers", () => {
  it("waits for authentication before creating a tracking category", async () => {
    const authentication = deferred();
    mocks.authenticate.mockReturnValueOnce(authentication.promise);
    mocks.createTrackingCategory.mockResolvedValueOnce({
      body: { trackingCategories: [{ name: "Cost centre" }] },
    });

    const result = createXeroTrackingCategory("Cost centre");

    await Promise.resolve();
    expect(mocks.createTrackingCategory).not.toHaveBeenCalled();

    authentication.resolve();

    await expect(result).resolves.toMatchObject({
      result: { name: "Cost centre" },
      isError: false,
    });
  });

  it("waits for authentication before creating tracking options", async () => {
    const authentication = deferred();
    mocks.authenticate.mockReturnValueOnce(authentication.promise);
    mocks.createTrackingOptions.mockResolvedValueOnce({
      body: { options: [{ name: "Sydney" }] },
    });

    const result = createXeroTrackingOptions("category-id", ["Sydney"]);

    await Promise.resolve();
    expect(mocks.createTrackingOptions).not.toHaveBeenCalled();

    authentication.resolve();

    await expect(result).resolves.toMatchObject({
      result: [{ name: "Sydney" }],
      isError: false,
    });
  });
});
