import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listXeroManualJournals: vi.fn(),
}));

vi.mock("../../handlers/list-xero-manual-journals.handler.js", () => ({
  listXeroManualJournals: mocks.listXeroManualJournals,
}));

import ListManualJournalsTool from "./list-manual-journals.tool.js";

describe("list-manual-journals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders zero values and false flags without undefined placeholders", async () => {
    mocks.listXeroManualJournals.mockResolvedValue({
      result: [{
        manualJournalID: "journal-id",
        narration: "Month end adjustment",
        journalLines: [{
          lineAmount: 0,
          accountCode: "200",
          taxAmount: 0,
        }],
        showOnCashBasisReports: false,
        hasAttachments: false,
      }],
      isError: false,
      error: null,
    });

    const result = await ListManualJournalsTool().handler({ page: 1 }, {} as never);
    const journalText = result.content[1]?.type === "text" ? result.content[1].text : "";

    expect(journalText).toContain("Line Amount: 0");
    expect(journalText).toContain("Tax Amount: 0");
    expect(journalText).toContain("Show on Cash Basis Reports: No");
    expect(journalText).toContain("Has Attachments: No");
    expect(journalText).not.toContain("undefined");
  });

  it("identifies a journal with no returned lines", async () => {
    mocks.listXeroManualJournals.mockResolvedValue({
      result: [{
        manualJournalID: "journal-id",
        narration: "Month end adjustment",
        journalLines: [],
      }],
      isError: false,
      error: null,
    });

    const result = await ListManualJournalsTool().handler({ page: 1 }, {} as never);
    const journalText = result.content[1]?.type === "text" ? result.content[1].text : "";

    expect(journalText).toContain("No journal lines");
  });

  it("rejects a blank journal ID", () => {
    const schema = z.object(ListManualJournalsTool().schema as z.ZodRawShape);

    expect(schema.safeParse({ manualJournalId: "   " }).success).toBe(false);
    expect(schema.safeParse({ manualJournalId: "journal-id" }).success).toBe(true);
  });
});
