import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createXeroManualJournal: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/create-xero-manual-journal.handler.js", () => ({
  createXeroManualJournal: mocks.createXeroManualJournal,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { MANUAL_JOURNAL: "MANUAL_JOURNAL" },
  getDeepLink: mocks.getDeepLink,
}));

import CreateManualJournalTool from "./create-manual-journal.tool.js";

describe("create-manual-journal tool", () => {
  const tool = CreateManualJournalTool();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDeepLink.mockResolvedValue(null);
  });

  it("renders journal lines and their tracking allocations as text", async () => {
    mocks.createXeroManualJournal.mockResolvedValue({
      result: {
        manualJournalID: "manual-journal-id",
        narration: "Accrual",
        journalLines: [
          {
            lineAmount: 100,
            accountCode: "200",
            tracking: [{ name: "Region", option: "North" }],
          },
        ],
      },
      isError: false,
      error: null,
    });

    const result = await tool.handler({
      narration: "Accrual",
      manualJournalLines: [
        { lineAmount: 100, accountCode: "200" },
        { lineAmount: -100, accountCode: "300" },
      ],
    }, {} as never);

    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Account Code: 200"),
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("Tracking: North"),
    });
    expect(result.content[0]).toMatchObject({
      text: expect.not.stringContaining("[object Object]"),
    });
  });
});
