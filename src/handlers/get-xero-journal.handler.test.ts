import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { getXeroJournal } from "./get-xero-journal.handler.js";

const journal = {
  journalID: "j-1",
  journalNumber: 101,
  journalDate: "2026-08-01",
  sourceType: "MANJOURNAL",
  journalLines: [
    { accountCode: "200", netAmount: 80, description: "Debit" },
    { accountCode: "400", netAmount: -80, description: "Credit" },
  ],
};

describe("getXeroJournal", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("retrieves a journal by ID", async () => {
    mockAccountingApi.getJournal.mockResolvedValue({
      body: { journals: [journal] },
    });

    const result = await getXeroJournal({ journalId: "j-1" });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.journalID).toBe("j-1");
    expect(mockAccountingApi.getJournal).toHaveBeenCalledWith(
      "tenant-1",
      "j-1",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockAccountingApi.getJournalByNumber).not.toHaveBeenCalled();
  });

  it("retrieves a journal by number", async () => {
    mockAccountingApi.getJournalByNumber.mockResolvedValue({
      body: { journals: [journal] },
    });

    const result = await getXeroJournal({ journalNumber: 101 });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.journalNumber).toBe(101);
    expect(mockAccountingApi.getJournalByNumber).toHaveBeenCalledWith(
      "tenant-1",
      101,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("prefers ID when both ID and number are provided", async () => {
    mockAccountingApi.getJournal.mockResolvedValue({
      body: { journals: [journal] },
    });

    await getXeroJournal({ journalId: "j-1", journalNumber: 101 });

    expect(mockAccountingApi.getJournal).toHaveBeenCalledOnce();
    expect(mockAccountingApi.getJournalByNumber).not.toHaveBeenCalled();
  });

  it("returns an error when neither ID nor number is provided", async () => {
    const result = await getXeroJournal({});

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Provide a journalId or journalNumber.",
    });
    expect(mockAccountingApi.getJournal).not.toHaveBeenCalled();
  });

  it("returns an error when Xero returns no journal", async () => {
    mockAccountingApi.getJournal.mockResolvedValue({
      body: { journals: [] },
    });

    const result = await getXeroJournal({ journalId: "missing" });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Journal not found.",
    });
  });
});
