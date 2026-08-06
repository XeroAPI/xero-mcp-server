import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  updateManualJournal: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      updateManualJournal: mocks.updateManualJournal,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { updateXeroManualJournal } from "../update-xero-manual-journal.handler.js";

describe("updateXeroManualJournal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateManualJournal.mockResolvedValue({
      body: { manualJournals: [{ manualJournalID: "manual-journal-id" }] },
    });
  });

  it("preserves tracking allocations on journal lines", async () => {
    const tracking = [{
      trackingCategoryID: "category-id",
      trackingOptionID: "option-id",
    }];
    const result = await updateXeroManualJournal(
      "Accrual",
      "manual-journal-id",
      [
        { lineAmount: 100, accountCode: "200", tracking },
        { lineAmount: -100, accountCode: "300" },
      ],
    );

    expect(result.isError).toBe(false);
    expect(
      mocks.updateManualJournal.mock.calls[0][2].manualJournals[0].journalLines?.[0].tracking,
    ).toEqual(tracking);
  });

  it("forwards an idempotency key for safe journal-update retries", async () => {
    const result = await updateXeroManualJournal(
      "Accrual",
      "manual-journal-id",
      [
        { lineAmount: 100, accountCode: "200" },
        { lineAmount: -100, accountCode: "300" },
      ],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "manual-journal-update-retry-key",
    );

    expect(result.isError).toBe(false);
    expect(mocks.updateManualJournal.mock.calls[0][3]).toBe(
      "manual-journal-update-retry-key",
    );
  });

  it("returns Xero validation errors instead of reporting a successful update", async () => {
    mocks.updateManualJournal.mockResolvedValue({
      body: {
        manualJournals: [{
          validationErrors: [{ message: "Journal lines must balance." }],
        }],
      },
    });

    const result = await updateXeroManualJournal(
      "Accrual",
      "manual-journal-id",
      [
        { lineAmount: 100, accountCode: "200" },
        { lineAmount: -100, accountCode: "300" },
      ],
    );

    expect(result).toMatchObject({
      result: null,
      isError: true,
      error: "Journal lines must balance.",
    });
  });
});
