import { describe, expect, it } from "vitest";
import {
  assessTrialBalanceIntegrity,
  formatAmount,
  formatIntegrityMessage,
  parseAmount,
  type ReportRow,
  type TrialBalanceReport,
} from "../trial-balance-integrity.js";

const HEADER = ["Account", "Debit", "Credit", "YTD Debit", "YTD Credit"] as const;

function headerRow(titles: readonly string[] = HEADER): ReportRow {
  return {
    rowType: "Header",
    cells: titles.map((title) => ({ value: title })),
  };
}

function accountRow(
  label: string,
  debit: string,
  credit: string,
  ytdDebit: string,
  ytdCredit: string,
  index = 1,
): ReportRow {
  return {
    rowType: "Row",
    cells: [
      {
        value: label,
        attributes: [{ id: "account", value: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}` }],
      },
      { value: debit },
      { value: credit },
      { value: ytdDebit },
      { value: ytdCredit },
    ],
  };
}

function report(accounts: Array<[string, string, string, string, string]>, titles: readonly string[] = HEADER): TrialBalanceReport {
  const rows: ReportRow[] = [headerRow(titles)];
  const data = accounts.map((tuple, i) => accountRow(tuple[0], tuple[1], tuple[2], tuple[3], tuple[4], i + 1));
  data.push({
    rowType: "SummaryRow",
    cells: [{ value: "Total" }, { value: "999" }, { value: "999" }, { value: "999" }, { value: "999" }],
  });
  rows.push({ rowType: "Section", title: "Revenue", rows: data });
  return { reportName: "Trial Balance", reportDate: "30 June 2026", rows };
}

describe("parseAmount", () => {
  it("treats blank and missing as zero", () => {
    expect(parseAmount("")).toEqual({ n: 0n, scale: 0 });
    expect(parseAmount(null)).toEqual({ n: 0n, scale: 0 });
    expect(parseAmount("   ")).toEqual({ n: 0n, scale: 0 });
  });

  it("parses exact decimals without float", () => {
    expect(parseAmount("0.10")).toEqual({ n: 10n, scale: 2 });
    expect(parseAmount("0.20")).toEqual({ n: 20n, scale: 2 });
    expect(formatAmount({ n: 30n, scale: 2 })).toBe("0.30");
  });

  it.each(["n/a", "1e3", "1,000.00", "."])("refuses non-amounts: %s", (text) => {
    expect(parseAmount(text)).toEqual(expect.objectContaining({ error: expect.stringContaining("not an amount") }));
  });

  it("parses signs and whole numbers", () => {
    expect(parseAmount("-12.5")).toEqual({ n: -125n, scale: 1 });
    expect(parseAmount("+7")).toEqual({ n: 7n, scale: 0 });
    expect(parseAmount(42)).toEqual({ n: 42n, scale: 0 });
  });
});

describe("assessTrialBalanceIntegrity", () => {
  it.each([
    { rows: [headerRow(["Anything"])] },
    { rows: [headerRow()] },
    report([]),
    { rows: [headerRow(), accountRow("Cash", "1", "", "1", "")] },
    {
      rows: [headerRow(), { rowType: "Section", rows: [
        { ...accountRow("Cash", "1", "", "1", ""), rowType: "Unexpected" },
      ] }],
    },
  ])("BLOCKs incomplete or unsupported report shapes: %j", (payload) => {
    expect(assessTrialBalanceIntegrity(payload).status).toBe("BLOCKED");
  });

  it("PASSes 0.1 + 0.2 against 0.3 (no IEEE float)", () => {
    const result = assessTrialBalanceIntegrity(
      report([
        ["Cash (090)", "0.1", "", "0.1", ""],
        ["Receivable (100)", "0.2", "", "0.2", ""],
        ["Sales (200)", "", "0.3", "", "0.3"],
      ]),
    );
    expect(result.status).toBe("PASS");
    if (result.status !== "PASS") return;
    expect(result.movementDebits).toBe("0.30");
    expect(result.movementCredits).toBe("0.30");
  });

  it("PASSes when movement and YTD both balance, ignoring SummaryRow", () => {
    const result = assessTrialBalanceIntegrity(
      report([
        ["Sales (200)", "", "100.00", "", "400.00"],
        ["Cash (090)", "100.00", "", "400.00", ""],
      ]),
    );
    expect(result.status).toBe("PASS");
    if (result.status !== "PASS") return;
    expect(result.accountRows).toBe(2);
    expect(result.movementDebits).toBe("100.00");
    expect(result.movementCredits).toBe("100.00");
    expect(result.ytdDebits).toBe("400.00");
    expect(result.ytdCredits).toBe("400.00");
    expect(formatIntegrityMessage(result)).toContain("do not approve the period close");
  });

  it("BLOCKs when movement is unbalanced even if YTD balances", () => {
    const result = assessTrialBalanceIntegrity(
      report([
        ["Sales (200)", "", "100.00", "", "400.00"],
        ["Cash (090)", "90.00", "", "400.00", ""],
      ]),
    );
    expect(result.status).toBe("BLOCKED");
    if (result.status !== "BLOCKED") return;
    expect(result.reason).toContain("movement");
    expect(result.reason).toContain("Trial balance withheld");
  });

  it("BLOCKs when YTD is unbalanced even if movement balances", () => {
    const result = assessTrialBalanceIntegrity(
      report([
        ["Sales (200)", "", "50.00", "", "400.00"],
        ["Cash (090)", "50.00", "", "399.99", ""],
      ]),
    );
    expect(result.status).toBe("BLOCKED");
    if (result.status !== "BLOCKED") return;
    expect(result.reason).toContain("YTD");
  });

  it("BLOCKs a missing expected column", () => {
    const result = assessTrialBalanceIntegrity(
      report([["Cash (090)", "1", "1", "1", "1"]], ["Account", "Debit", "Credit", "YTD Debit"]),
    );
    expect(result.status).toBe("BLOCKED");
    if (result.status !== "BLOCKED") return;
    expect(result.reason).toContain("YTD Credit");
  });

  it("BLOCKs a row whose cell count does not match the header", () => {
    const payload: TrialBalanceReport = {
      rows: [
        headerRow(),
        {
          rowType: "Section",
          title: "Assets",
          rows: [
            {
              rowType: "Row",
              cells: [{ value: "Cash (090)" }, { value: "1.00" }],
            },
          ],
        },
      ],
    };
    const result = assessTrialBalanceIntegrity(payload);
    expect(result.status).toBe("BLOCKED");
    if (result.status !== "BLOCKED") return;
    expect(result.reason).toContain("2 cells under 5 header columns");
  });

  it("BLOCKs a missing report", () => {
    expect(assessTrialBalanceIntegrity(null).status).toBe("BLOCKED");
  });
});
