import { describe, expect, it, vi } from "vitest";

vi.mock("../handlers/create-xero-manual-journal.handler.js", () => ({
  createXeroManualJournal: vi.fn(),
}));

vi.mock("../handlers/update-xero-manual-journal.handler.js", () => ({
  updateXeroManualJournal: vi.fn(),
}));

vi.mock("../helpers/get-deeplink.js", () => ({
  DeepLinkType: {
    MANUAL_JOURNAL: "MANUAL_JOURNAL",
  },
  getDeepLink: vi.fn(),
}));

import CreateManualJournalTool from "./create/create-manual-journal.tool.js";
import UpdateManualJournalTool from "./update/update-manual-journal-tool.js";

describe("manual journal status validation", () => {
  it.each([
    ["create", CreateManualJournalTool],
    ["update", UpdateManualJournalTool],
  ] as const)("accepts writable statuses only for %s", (_operation, createTool) => {
    const schema = createTool().schema as unknown as {
      status: { safeParse: (value: unknown) => { success: boolean } };
    };

    expect(schema.status.safeParse("DRAFT").success).toBe(true);
    expect(schema.status.safeParse("POSTED").success).toBe(true);
    expect(schema.status.safeParse("DELETED").success).toBe(false);
    expect(schema.status.safeParse("VOIDED").success).toBe(false);
    expect(schema.status.safeParse("ARCHIVED").success).toBe(false);
  });
});
