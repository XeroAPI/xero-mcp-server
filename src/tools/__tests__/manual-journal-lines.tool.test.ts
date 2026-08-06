import { describe, expect, it } from "vitest";
import { type ZodRawShape, z } from "zod";

const journalLines = [
  { accountCode: "200", lineAmount: 100 },
  { accountCode: "300", lineAmount: -100 },
];

describe("manual journal tools", () => {
  it("requires at least two journal lines when creating a journal", async () => {
    const originalBearerToken = process.env.XERO_CLIENT_BEARER_TOKEN;
    process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";

    const { default: CreateManualJournalTool } = await import(
      "../create/create-manual-journal.tool.js"
    );
    const schema = z.object(CreateManualJournalTool().schema as ZodRawShape);

    if (originalBearerToken === undefined) {
      delete process.env.XERO_CLIENT_BEARER_TOKEN;
    } else {
      process.env.XERO_CLIENT_BEARER_TOKEN = originalBearerToken;
    }

    const invalid = schema.safeParse({
      narration: "One line journal",
      manualJournalLines: [journalLines[0]],
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toBe(
        "At least two journal lines are required",
      );
    }
    expect(
      schema.safeParse({
        narration: "Balanced journal",
        manualJournalLines: journalLines,
      }).success,
    ).toBe(true);
  });

  it("requires at least two journal lines when updating a journal", async () => {
    const { default: UpdateManualJournalTool } = await import(
      "../update/update-manual-journal-tool.js"
    );
    const schema = z.object(UpdateManualJournalTool().schema as ZodRawShape);

    const invalid = schema.safeParse({
      narration: "One line journal",
      manualJournalID: "journal-id",
      manualJournalLines: [journalLines[0]],
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toBe(
        "At least two journal lines are required",
      );
    }
    expect(
      schema.safeParse({
        narration: "Balanced journal",
        manualJournalID: "journal-id",
        manualJournalLines: journalLines,
      }).success,
    ).toBe(true);
  });
});
