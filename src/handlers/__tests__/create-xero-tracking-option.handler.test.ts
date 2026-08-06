import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createTrackingOptions: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createTrackingOptions: mocks.createTrackingOptions,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { createXeroTrackingOptions } from "../create-xero-tracking-option.handler.js";

describe("createXeroTrackingOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue(undefined);
  });

  it("serializes writes and reports a partial batch failure", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mocks.createTrackingOptions.mockImplementation(async (
      _tenantId: string,
      _categoryId: string,
      payload: { name: string },
    ) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;

      if (payload.name === "Fail") {
        throw new Error("create failed");
      }

      return {
        body: {
          options: [{ trackingOptionID: `id-${payload.name}`, name: payload.name }],
        },
      };
    });

    const result = await createXeroTrackingOptions("category-id", ["One", "Fail", "Two"]);

    expect(maxInFlight).toBe(1);
    expect(mocks.authenticate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      isError: false,
      result: {
        trackingOptions: [
          { trackingOptionID: "id-One", name: "One" },
          { trackingOptionID: "id-Two", name: "Two" },
        ],
        failures: [{ input: "Fail", error: "create failed" }],
      },
    });
  });
});
