import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateXeroManualJournal: vi.fn(),
  getDeepLink: vi.fn(),
}));

vi.mock("../../handlers/update-xero-manual-journal.handler.js", () => ({
  updateXeroManualJournal: mocks.updateXeroManualJournal,
}));

vi.mock("../../helpers/get-deeplink.js", () => ({
  DeepLinkType: { MANUAL_JOURNAL: "MANUAL_JOURNAL" },
  getDeepLink: mocks.getDeepLink,
}));

import UpdateManualJournalTool from "./update-manual-journal-tool.js";

describe("update-manual-journal tool", () => {
  const tool = UpdateManualJournalTool();
  const schema = z.object(tool.schema as z.ZodRawShape);
  const manualJournalLines = [
    { lineAmount: 100, accountCode: "200" },
    { lineAmount: -100, accountCode: "300" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateXeroManualJournal.mockResolvedValue({
      result: { manualJournalID: "manual-journal-id", narration: "Accrual" },
      isError: false,
      error: null,
    });
    mocks.getDeepLink.mockResolvedValue(null);
  });

  it("forwards an idempotency key for safe retries", async () => {
    await tool.handler({
      narration: "Accrual",
      manualJournalID: "manual-journal-id",
      manualJournalLines,
      idempotencyKey: "manual-journal-update-retry-key",
    }, {} as never);

    expect(mocks.updateXeroManualJournal.mock.calls[0][8]).toBe(
      "manual-journal-update-retry-key",
    );
  });

  it("limits idempotency keys to Xero's supported length", () => {
    const base = {
      narration: "Accrual",
      manualJournalID: "manual-journal-id",
      manualJournalLines,
    };

    expect(schema.safeParse({ ...base, idempotencyKey: "x".repeat(128) }).success).toBe(true);
    expect(schema.safeParse({ ...base, idempotencyKey: "x".repeat(129) }).success).toBe(false);
  });
});
