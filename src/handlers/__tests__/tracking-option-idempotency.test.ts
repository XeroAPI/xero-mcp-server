import { beforeEach, describe, expect, it, vi } from "vitest";

import { runWithIdempotencyKey } from "../../helpers/idempotency-key.js";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createTrackingOptions: vi.fn(),
  getTrackingCategory: vi.fn(),
  updateTrackingOptions: vi.fn(),
  getClientHeaders: vi.fn(() => ({ headers: { "x-test": "test" } })),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createTrackingOptions: mocks.createTrackingOptions,
      getTrackingCategory: mocks.getTrackingCategory,
      updateTrackingOptions: mocks.updateTrackingOptions,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: mocks.getClientHeaders,
}));

const { createXeroTrackingOptions } =
  await import("../create-xero-tracking-option.handler.js");
const { updateXeroTrackingOption } =
  await import("../update-xero-tracking-options.handler.js");

function idempotencyKeys(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((call) => call[3] as string);
}

describe("tracking-option fan-out idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientHeaders.mockReturnValue({ headers: { "x-test": "test" } });
  });

  it("uses distinct stable create keys and safely reuses only the failed item", async () => {
    mocks.createTrackingOptions.mockImplementation(
      async (_tenant: string, _category: string, option: { name: string }) => {
        if (option.name === "Beta") throw new Error("synthetic failure");
        return { body: { options: [{ name: option.name }] } };
      },
    );

    await runWithIdempotencyKey("parent-key", () =>
      createXeroTrackingOptions("category-id", ["Alpha", "Beta"]),
    );
    const firstAttempt = idempotencyKeys(mocks.createTrackingOptions);

    expect(firstAttempt).toHaveLength(2);
    expect(firstAttempt[0]).not.toBe(firstAttempt[1]);
    expect(firstAttempt.every((key) => key.length <= 128)).toBe(true);

    mocks.createTrackingOptions.mockClear();
    mocks.createTrackingOptions.mockResolvedValue({
      body: { options: [{ name: "Beta" }] },
    });
    await runWithIdempotencyKey("parent-key", () =>
      createXeroTrackingOptions("category-id", ["Beta"]),
    );

    expect(idempotencyKeys(mocks.createTrackingOptions)).toEqual([
      firstAttempt[1],
    ]);
  });

  it("uses distinct stable update keys for each option", async () => {
    mocks.getTrackingCategory.mockResolvedValue({
      body: {
        trackingCategories: [
          {
            options: [
              { trackingOptionID: "option-a", name: "Alpha", status: "ACTIVE" },
              { trackingOptionID: "option-b", name: "Beta", status: "ACTIVE" },
            ],
          },
        ],
      },
    });
    mocks.updateTrackingOptions.mockResolvedValue({ body: {} });
    const options = [
      { trackingOptionId: "option-a", status: "ARCHIVED" as const },
      { trackingOptionId: "option-b", name: "Beta 2" },
    ];

    await runWithIdempotencyKey("parent-key", () =>
      updateXeroTrackingOption("category-id", options),
    );
    const firstAttempt = idempotencyKeys(mocks.updateTrackingOptions);

    mocks.updateTrackingOptions.mockClear();
    await runWithIdempotencyKey("parent-key", () =>
      updateXeroTrackingOption("category-id", options),
    );

    expect(firstAttempt).toHaveLength(2);
    expect(firstAttempt[0]).not.toBe(firstAttempt[1]);
    expect(idempotencyKeys(mocks.updateTrackingOptions)).toEqual(firstAttempt);
  });
});
