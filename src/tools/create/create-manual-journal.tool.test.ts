import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createXeroManualJournal: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-manual-journal.handler.js", () => ({
  createXeroManualJournal: mocks.createXeroManualJournal,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: {MANUAL_JOURNAL: "MANUAL_JOURNAL"},
  getDeepLink: mocks.getDeepLink,
}));

import CreateManualJournalTool from "./create-manual-journal.tool.js";

describe("create-manual-journal response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createXeroManualJournal.mockResolvedValue({
      isError: false,
      error: null,
      result: {
        narration: "Month end adjustment",
        manualJournalID: "journal-id",
        journalLines: [{
          lineAmount: 100,
          accountCode: "200",
          description: "Debit",
          taxType: "NONE",
          taxAmount: 0,
        }],
      },
    });
    mocks.getDeepLink.mockResolvedValue(undefined);
  });

  it("renders journal-line text instead of object coercions", async () => {
    const tool = CreateManualJournalTool();
    const result = await tool.handler({
      narration: "Month end adjustment",
      manualJournalLines: [
        {lineAmount: 100, accountCode: "200"},
        {lineAmount: -100, accountCode: "400"},
      ],
    }, {} as never);

    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(text).toContain("Line Amount: 100");
    expect(text).toContain("Account Code: 200");
    expect(text).toContain("Tax Amount: 0");
    expect(text).toContain("Show on Cash Basis Reports: Not specified");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("[object Object]");
  });

  it("renders an explicit fallback when Xero returns no journal lines", async () => {
    mocks.createXeroManualJournal.mockResolvedValue({
      isError: false,
      error: null,
      result: {
        narration: "Month end adjustment",
        manualJournalID: "journal-id",
        journalLines: [],
        showOnCashBasisReports: false,
      },
    });

    const result = await CreateManualJournalTool().handler(
      {
        narration: "Month end adjustment",
        manualJournalLines: [
          { lineAmount: 100, accountCode: "200" },
          { lineAmount: -100, accountCode: "400" },
        ],
      },
      {} as never,
    );
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";

    expect(text).toContain("No journal lines");
    expect(text).toContain("Show on Cash Basis Reports: No");
    expect(text).not.toContain("undefined");
  });

  it("renders an explicit fallback for omitted journal-line tax amounts", async () => {
    mocks.createXeroManualJournal.mockResolvedValue({
      isError: false,
      error: null,
      result: {
        narration: "Month end adjustment",
        manualJournalID: "journal-id",
        journalLines: [{ lineAmount: 100, accountCode: "200" }],
      },
    });

    const result = await CreateManualJournalTool().handler(
      {
        narration: "Month end adjustment",
        manualJournalLines: [
          { lineAmount: 100, accountCode: "200" },
          { lineAmount: -100, accountCode: "400" },
        ],
      },
      {} as never,
    );
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";

    expect(text).toContain("Tax Amount: Not specified");
    expect(text).toContain("Show on Cash Basis Reports: Not specified");
    expect(text).not.toContain("undefined");
  });
});
