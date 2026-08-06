import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createManualJournals: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createManualJournals: mocks.createManualJournals,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { createXeroManualJournal } from "../create-xero-manual-journal.handler.js";

describe("createXeroManualJournal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createManualJournals.mockResolvedValue({
      body: { manualJournals: [{ manualJournalID: "manual-journal-id" }] },
    });
  });

  it("forwards an idempotency key for safe retries", async () => {
    const result = await createXeroManualJournal(
      "Accrual",
      [
        { lineAmount: 100, accountCode: "200" },
        { lineAmount: -100, accountCode: "300" },
      ],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "manual-journal-retry-key",
    );

    expect(result.isError).toBe(false);
    expect(mocks.createManualJournals.mock.calls[0][3]).toBe(
      "manual-journal-retry-key",
    );
  });

  it("preserves tracking allocations on journal lines", async () => {
    const tracking = [{
      trackingCategoryID: "category-id",
      trackingOptionID: "option-id",
    }];

    const result = await createXeroManualJournal(
      "Accrual",
      [
        { lineAmount: 100, accountCode: "200", tracking },
        { lineAmount: -100, accountCode: "300" },
      ],
    );

    expect(result.isError).toBe(false);
    expect(
      mocks.createManualJournals.mock.calls[0][1].manualJournals[0].journalLines?.[0].tracking,
    ).toEqual(tracking);
  });

  it("returns Xero validation errors instead of reporting a successful creation", async () => {
    mocks.createManualJournals.mockResolvedValue({
      body: {
        manualJournals: [{
          validationErrors: [{ message: "Account code is invalid." }],
        }],
      },
    });

    const result = await createXeroManualJournal(
      "Accrual",
      [
        { lineAmount: 100, accountCode: "200" },
        { lineAmount: -100, accountCode: "300" },
      ],
    );

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Account code is invalid.",
    });
  });
});
