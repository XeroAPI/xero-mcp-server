import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getManualJournal: vi.fn(),
  getManualJournals: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      getManualJournal: mocks.getManualJournal,
      getManualJournals: mocks.getManualJournals,
    },
  },
}));

vi.mock("../../helpers/get-client-headers.js", () => ({
  getClientHeaders: () => ({ headers: {} }),
}));

import { listXeroManualJournals } from "../list-xero-manual-journals.handler.js";

describe("listXeroManualJournals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a blank supplied ID instead of listing every journal", async () => {
    const result = await listXeroManualJournals(1, "   ");

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Manual journal ID must not be blank.",
    });
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.getManualJournal).not.toHaveBeenCalled();
    expect(mocks.getManualJournals).not.toHaveBeenCalled();
  });

  it("rejects a blank modified-after date instead of listing every journal", async () => {
    const result = await listXeroManualJournals(1, undefined, "   ");

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Modified-after date must not be blank.",
    });
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.getManualJournal).not.toHaveBeenCalled();
    expect(mocks.getManualJournals).not.toHaveBeenCalled();
  });

  it("trims a supplied journal ID before retrieving that journal", async () => {
    mocks.getManualJournal.mockResolvedValue({
      body: { manualJournals: [{ narration: "Month end adjustment" }] },
    });

    const result = await listXeroManualJournals(1, " journal-id ");

    expect(result).toMatchObject({ isError: false, error: null });
    expect(mocks.getManualJournal).toHaveBeenCalledWith(
      "tenant-id",
      "journal-id",
      { headers: {} },
    );
    expect(mocks.getManualJournals).not.toHaveBeenCalled();
  });

  it("trims a supplied modified-after date before listing journals", async () => {
    mocks.getManualJournals.mockResolvedValue({ body: { manualJournals: [] } });

    const result = await listXeroManualJournals(2, undefined, " 2026-01-31 ");

    expect(result).toMatchObject({ isError: false, error: null });
    expect(mocks.getManualJournals).toHaveBeenCalledWith(
      "tenant-id",
      new Date("2026-01-31"),
      undefined,
      "UpdatedDateUTC DESC",
      2,
      10,
      { headers: {} },
    );
    expect(mocks.getManualJournal).not.toHaveBeenCalled();
  });
});
