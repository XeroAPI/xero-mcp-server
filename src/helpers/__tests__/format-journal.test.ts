import { describe, expect, it } from "vitest";
import { formatJournal } from "../format-journal.js";

describe("formatJournal", () => {
  it("labels positive net amounts as debit and negative as credit", () => {
    const text = formatJournal({
      journalID: "j-1",
      journalNumber: 44,
      journalDate: "2026-08-01",
      sourceType: "ACCREC" as never,
      sourceID: "inv-1",
      reference: "INV-100",
      journalLines: [
        {
          accountCode: "200",
          accountName: "Sales",
          netAmount: 80,
          description: "Invoice",
        },
        {
          accountCode: "610",
          accountName: "Accounts Receivable",
          netAmount: -80,
        },
      ],
    });

    expect(text).toContain("Journal ID: j-1");
    expect(text).toContain("Journal Number: 44");
    expect(text).toContain("Source Type: ACCREC");
    expect(text).toContain("Source ID: inv-1");
    expect(text).toContain("Account: 200 Sales");
    expect(text).toContain("Debit: 80");
    expect(text).toContain("Credit: 80");
    expect(text).toContain("Description: Invoice");
  });

  it("omits the lines section when none are present", () => {
    const text = formatJournal({
      journalID: "j-2",
      journalNumber: 45,
    });

    expect(text).toContain("Journal ID: j-2");
    expect(text).not.toContain("Lines:");
  });
});
